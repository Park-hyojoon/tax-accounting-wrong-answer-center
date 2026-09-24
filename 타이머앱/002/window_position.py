"""Keep the complete timer window inside its monitor's usable work area."""
import ctypes
from ctypes import wintypes as wt


class MONITORINFO(ctypes.Structure):
    _fields_ = [('cbSize', wt.DWORD), ('rcMonitor', wt.RECT),
                ('rcWork', wt.RECT), ('dwFlags', wt.DWORD)]


def clamp_position(window, work, margin=6):
    """Return an outer-window position clear of the taskbar and screen edges."""
    width, height = window.right - window.left, window.bottom - window.top
    left = work.left + margin
    top = work.top + margin
    right = max(left, work.right - margin - width)
    bottom = max(top, work.bottom - margin - height)
    return min(max(window.left, left), right), min(max(window.top, top), bottom)


def keep_visible(root):
    user32 = ctypes.windll.user32
    get_ancestor = user32.GetAncestor
    get_ancestor.argtypes, get_ancestor.restype = [wt.HWND, wt.UINT], wt.HWND
    hwnd = get_ancestor(root.winfo_id(), 2)  # Tk's outer top-level frame.
    if not hwnd or user32.IsIconic(hwnd):
        return
    get_rect = user32.GetWindowRect
    get_rect.argtypes, get_rect.restype = [wt.HWND, ctypes.POINTER(wt.RECT)], wt.BOOL
    monitor_from = user32.MonitorFromWindow
    monitor_from.argtypes, monitor_from.restype = [wt.HWND, wt.DWORD], ctypes.c_void_p
    get_info = user32.GetMonitorInfoW
    get_info.argtypes, get_info.restype = [ctypes.c_void_p, ctypes.POINTER(MONITORINFO)], wt.BOOL
    set_position = user32.SetWindowPos
    set_position.argtypes = [wt.HWND, wt.HWND, ctypes.c_int, ctypes.c_int,
                             ctypes.c_int, ctypes.c_int, wt.UINT]
    set_position.restype = wt.BOOL
    window = wt.RECT()
    info = MONITORINFO()
    info.cbSize = ctypes.sizeof(info)
    if not get_rect(hwnd, ctypes.byref(window)):
        raise ctypes.WinError()
    monitor = monitor_from(hwnd, 2)  # Nearest monitor when the window is off-screen.
    if not monitor or not get_info(monitor, ctypes.byref(info)):
        raise ctypes.WinError()
    x, y = clamp_position(window, info.rcWork)
    if (x, y) != (window.left, window.top):
        # Position the OS frame; Tk's client coordinates omit the title bar.
        if not set_position(hwnd, None, x, y, 0, 0, 0x15):
            raise ctypes.WinError()
