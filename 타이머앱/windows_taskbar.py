"""Give pinned timer shortcuts the same identity, icon and launch command as the window."""
import ctypes
from ctypes import wintypes as wt
import os
import subprocess
import sys
import uuid

APP_ID = 'KcLep.WrongAnswer.Timer'


class GUID(ctypes.Structure):
    _fields_ = [('data', ctypes.c_ubyte * 16)]

    @classmethod
    def from_text(cls, text):
        return cls.from_buffer_copy(uuid.UUID(text).bytes_le)


class PROPERTYKEY(ctypes.Structure):
    _fields_ = [('fmtid', GUID), ('pid', wt.DWORD)]


class ValueUnion(ctypes.Union):
    _fields_ = [('pointer', ctypes.c_void_p), ('storage', ctypes.c_void_p * 2)]


class PROPVARIANT(ctypes.Structure):
    _anonymous_ = ('value',)
    _fields_ = [('vt', wt.WORD), ('reserved1', wt.WORD), ('reserved2', wt.WORD),
                ('reserved3', wt.WORD), ('value', ValueUnion)]


def check(result):
    if result < 0:
        raise OSError(f'Windows taskbar property error: 0x{result & 0xffffffff:08x}')


def set_process_identity():
    function = ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID
    function.argtypes = [wt.LPCWSTR]
    function.restype = ctypes.c_long
    check(function(APP_ID))


def relaunch_command(script):
    executable = sys.executable
    windowed = os.path.join(os.path.dirname(executable), 'pythonw.exe')
    if os.path.isfile(windowed):
        executable = windowed
    return subprocess.list2cmdline([executable, os.path.abspath(script)])


def configure_window(hwnd, script, icon):
    initialized = ctypes.windll.ole32.CoInitializeEx(None, 2)
    if initialized < 0 and initialized != -2147417850:  # RPC_E_CHANGED_MODE: already initialized.
        check(initialized)
    try:
        _configure_window(hwnd, script, icon)
    finally:
        if initialized >= 0:
            ctypes.windll.ole32.CoUninitialize()


def _configure_window(hwnd, script, icon):
    """Set relaunch properties before AppUserModel.ID so Explorer pins this app."""
    get_store = ctypes.windll.shell32.SHGetPropertyStoreForWindow
    get_store.argtypes = [wt.HWND, ctypes.POINTER(GUID), ctypes.POINTER(ctypes.c_void_p)]
    get_store.restype = ctypes.c_long
    iid = GUID.from_text('886d8eeb-8cf2-4446-8d02-cdba1dbdcf99')
    store = ctypes.c_void_p()
    check(get_store(hwnd, ctypes.byref(iid), ctypes.byref(store)))
    vtable = ctypes.cast(store, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
    release = ctypes.WINFUNCTYPE(wt.ULONG, ctypes.c_void_p)(vtable[2])
    set_value = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p,
                                  ctypes.POINTER(PROPERTYKEY), ctypes.POINTER(PROPVARIANT))(vtable[6])
    commit = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p)(vtable[7])
    get_key = ctypes.windll.propsys.PSGetPropertyKeyFromName
    get_key.argtypes = [wt.LPCWSTR, ctypes.POINTER(PROPERTYKEY)]
    get_key.restype = ctypes.c_long
    try:
        for name, text in (
            ('RelaunchCommand', relaunch_command(script)),
            ('RelaunchDisplayNameResource', '학습 타이머'),
            ('RelaunchIconResource', os.path.abspath(icon) + ',0'),
            ('ID', APP_ID),
        ):
            key = PROPERTYKEY()
            check(get_key('System.AppUserModel.' + name, ctypes.byref(key)))
            buffer = ctypes.create_unicode_buffer(text)
            value = PROPVARIANT()
            value.vt = 31  # VT_LPWSTR; SetValue copies the caller-owned string.
            value.pointer = ctypes.cast(buffer, ctypes.c_void_p).value
            check(set_value(store, ctypes.byref(key), ctypes.byref(value)))
        check(commit(store))
    finally:
        release(store)


def configure_tk_window(root, script, icon):
    root.update_idletasks()
    get_ancestor = ctypes.windll.user32.GetAncestor
    get_ancestor.argtypes = [wt.HWND, wt.UINT]
    get_ancestor.restype = wt.HWND
    configure_window(get_ancestor(root.winfo_id(), 2), script, icon)
