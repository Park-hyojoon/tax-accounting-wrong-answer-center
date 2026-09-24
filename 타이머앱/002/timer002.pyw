"""Yellow stopwatch edition; timing and shortcuts are shared with the preserved core."""
import ctypes
import os
from pathlib import Path
import queue
import threading
import tkinter as tk
from collections import OrderedDict
import timer_core as core
from windows_taskbar import configure_tk_window, set_process_identity
from window_position import keep_visible

HERE = Path(__file__).resolve().parent
ICON = str(HERE / 'timer002.ico')
core.PALE, core.INK, core.BLUE = '#eef1f0', '#080a09', '#41483e'
core.RED, core.TRACK = '#ffdc00', '#dce1dd'


class Stopwatch(core.Timer):
    def __init__(self, root):
        self.root = root
        self.data = core.load_settings()
        self.problem = core.Clock(self.data['targetSeconds'])
        self.exam = core.Clock(self.data['examTargetSeconds'])
        self.events, self.key_commands = queue.Queue(), queue.Queue()
        self.key_ready = threading.Event()
        self.key_thread_id = None
        self.frames = OrderedDict()
        self.current_frame = None
        root.title('타이머 002')
        root.configure(bg=core.PALE)
        root.iconbitmap(default=ICON)
        root.attributes('-topmost', True)
        root.resizable(False, False)
        self.canvas = tk.Canvas(root, width=240, height=292, bg=core.PALE,
                                highlightthickness=0, cursor='hand2', takefocus=True)
        self.canvas.pack()
        self.art_id = self.canvas.create_image(0, 0, anchor='nw')
        self.text_id = self.canvas.create_text(120, 257, fill='#ffdc00',
                                               font=('Segoe UI', -34, 'bold'))
        self.canvas.bind('<Button-1>', self.clicked)
        self.canvas.bind('<Button-3>', lambda _e: self.shortcut_dialog())
        self.canvas.bind('<Return>', lambda _e: self.time_dialog('problem'))
        self.canvas.bind('<Motion>', self.hover)
        self.canvas.bind('<Leave>', lambda _e: root.title('타이머 002'))
        self.status = tk.Label(root, bg=core.PALE, fg='#b22b2b', wraplength=220,
                               font=('맑은 고딕', -11))
        threading.Thread(target=self.hotkey_loop, daemon=True).start()
        root.protocol('WM_DELETE_WINDOW', self.close)
        self.draw()
        root.after(50, self.tick)
        root.after(150, self.check_position)

    def check_position(self):
        if not self.root.winfo_exists():
            return
        try:
            keep_visible(self.root)
        except OSError:
            pass  # A monitor can briefly disappear while Windows changes displays.
        self.root.after(1000, self.check_position)

    @staticmethod
    def zone(x, y):
        if 99 <= x <= 141 and 2 <= y <= 30:
            return 'reset'
        if 165 <= x <= 205 and 19 <= y <= 55:
            return 'settings'
        if 27 <= x <= 213 and 232 <= y <= 285:
            return 'exam'
        if (x-120)**2 + (y-127)**2 <= 94**2:
            return 'problem'
        return None

    def clicked(self, event):
        zone = self.zone(event.x, event.y)
        if zone == 'reset':
            self.problem.reset()
        elif zone == 'settings':
            self.shortcut_dialog()
        elif zone in ('exam', 'problem'):
            self.time_dialog(zone)

    def hover(self, event):
        zone = self.zone(event.x, event.y)
        labels = {'reset':'문제 타이머 초기화', 'settings':'단축키 설정',
                  'exam':'시험 시간 설정', 'problem':'문제 시간 ' + self.problem.text() + ' · 눌러 설정'}
        self.root.title(labels.get(zone, '타이머 002'))
        self.canvas.config(cursor='hand2' if zone else 'arrow')

    def draw(self):
        left = self.problem.target - self.problem.elapsed()
        frame = 'overdue' if left < 0 else f'{round(max(0, min(1, left/self.problem.target))*180):03}'
        if frame != self.current_frame:
            if frame not in self.frames:
                self.frames[frame] = tk.PhotoImage(file=str(HERE / 'frames' / (frame + '.png')))
            self.frames.move_to_end(frame)
            self.canvas.itemconfigure(self.art_id, image=self.frames[frame])
            self.current_frame = frame
            while len(self.frames) > 16:
                self.frames.popitem(last=False)
        text = self.exam.text().replace(':', ' : ')
        self.canvas.itemconfigure(self.text_id, text=text,
                                  fill='#ff9a69' if self.exam.elapsed() > self.exam.target else '#ffdc00',
                                  font=('Segoe UI', -34 if len(text) <= 8 else -27, 'bold'))


if __name__ == '__main__':
    set_process_identity()
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except (AttributeError, OSError):
        pass
    root = tk.Tk()
    root.withdraw()
    Stopwatch(root)
    configure_tk_window(root, __file__, ICON)
    root.deiconify()
    root.mainloop()
