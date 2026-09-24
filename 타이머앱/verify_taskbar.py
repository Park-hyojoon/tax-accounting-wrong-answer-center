"""Read back real Windows pinning properties on an invisible test window."""
import ctypes
from ctypes import wintypes as wt
from pathlib import Path
from windows_taskbar import GUID, PROPERTYKEY, PROPVARIANT, APP_ID, check, configure_window, relaunch_command


def main():
    folder = Path(__file__).resolve().parent
    script, icon = folder / 'kclep_timer.pyw', folder / 'study-timer.ico'
    assert icon.is_file()
    user32 = ctypes.windll.user32
    create = user32.CreateWindowExW
    create.argtypes = [wt.DWORD, wt.LPCWSTR, wt.LPCWSTR, wt.DWORD, ctypes.c_int, ctypes.c_int,
                       ctypes.c_int, ctypes.c_int, wt.HWND, wt.HMENU, wt.HINSTANCE, ctypes.c_void_p]
    create.restype = wt.HWND
    destroy = user32.DestroyWindow
    destroy.argtypes = [wt.HWND]
    hwnd = create(0, 'STATIC', 'Timer property verification', 0, 0, 0, 1, 1, None, None, None, None)
    assert hwnd, 'Unable to create hidden verification window'
    try:
        configure_window(hwnd, str(script), str(icon))
        store = ctypes.c_void_p()
        iid = GUID.from_text('886d8eeb-8cf2-4446-8d02-cdba1dbdcf99')
        get_store = ctypes.windll.shell32.SHGetPropertyStoreForWindow
        check(get_store(hwnd, ctypes.byref(iid), ctypes.byref(store)))
        table = ctypes.cast(store, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
        get_value = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p,
                                      ctypes.POINTER(PROPERTYKEY), ctypes.POINTER(PROPVARIANT))(table[5])
        release = ctypes.WINFUNCTYPE(wt.ULONG, ctypes.c_void_p)(table[2])
        try:
            for name, expected in (
                ('ID', APP_ID), ('RelaunchCommand', relaunch_command(str(script))),
                ('RelaunchIconResource', str(icon) + ',0'), ('RelaunchDisplayNameResource', '학습 타이머'),
            ):
                key, value = PROPERTYKEY(), PROPVARIANT()
                check(ctypes.windll.propsys.PSGetPropertyKeyFromName('System.AppUserModel.' + name, ctypes.byref(key)))
                check(get_value(store, ctypes.byref(key), ctypes.byref(value)))
                try:
                    assert value.vt == 31 and ctypes.wstring_at(value.pointer) == expected, name
                finally:
                    ctypes.windll.ole32.PropVariantClear(ctypes.byref(value))
                print(name + ': OK')
        finally:
            release(store)
        load_icon = user32.LoadImageW
        load_icon.argtypes = [wt.HINSTANCE, wt.LPCWSTR, wt.UINT, ctypes.c_int, ctypes.c_int, wt.UINT]
        load_icon.restype = wt.HANDLE
        user32.DestroyIcon.argtypes = [wt.HANDLE]
        for size in (16, 24, 32, 48, 256):
            handle = load_icon(None, str(icon), 1, size, size, 0x10)
            assert handle, f'Icon load failed at {size}px'
            user32.DestroyIcon(handle)
        print('Windows icon loading: OK (16/24/32/48/256 px)')
    finally:
        destroy(hwnd)


if __name__ == '__main__':
    check(ctypes.windll.ole32.CoInitializeEx(None, 2))
    try:
        main()
    finally:
        ctypes.windll.ole32.CoUninitialize()
