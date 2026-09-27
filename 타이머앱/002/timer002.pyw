"""Stopwatch edition; the upper dial is exam time and the lower display is problem time."""
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
core.RED, core.TRACK = '#99cc3f', '#dce1dd'


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
        self.accent = self.data.get('accentColor', '#99cc3f')
        root.title('타이머 002')
        root.configure(bg=core.PALE)
        root.iconbitmap(default=ICON)
        root.attributes('-topmost', True)
        root.resizable(False, False)
        self.canvas = tk.Canvas(root, width=240, height=292, bg=core.PALE,
                                highlightthickness=0, cursor='hand2', takefocus=True)
        self.canvas.pack()
        self.art_id = self.canvas.create_image(0, 0, anchor='nw')
        self.exam_label_id = self.canvas.create_text(120, 161, text='시험 시간', fill=core.INK,
                                                     font=('맑은 고딕', -17, 'bold'))
        self.exam_target_id = self.canvas.create_text(120, 187, fill=core.INK,
                                                      font=('맑은 고딕', -18, 'bold'))
        self.problem_label_id = self.canvas.create_text(48, 258, text='문제\n시간', fill=self.accent,
                                                        justify='center',
                                                        font=('맑은 고딕', -15, 'bold'))
        self.text_id = self.canvas.create_text(148, 258, fill=self.accent,
                                               font=('Segoe UI', -31, 'bold'))
        self.canvas.bind('<Button-1>', self.clicked)
        self.canvas.bind('<Button-3>', lambda _e: self.shortcut_dialog())
        self.canvas.bind('<Return>', lambda _e: self.time_dialog('exam'))
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
            return 'problem'
        if (x-120)**2 + (y-127)**2 <= 94**2:
            return 'exam'
        return None

    def clicked(self, event):
        zone = self.zone(event.x, event.y)
        if zone == 'reset':
            self.exam.reset()
        elif zone == 'settings':
            self.shortcut_dialog()
        elif zone in ('exam', 'problem'):
            self.time_dialog(zone)

    def hover(self, event):
        zone = self.zone(event.x, event.y)
        labels = {'reset':'시험 타이머 초기화', 'settings':'단축키·색상 설정',
                  'problem':'문제 시간 ' + self.problem.text() + ' · 눌러 설정',
                  'exam':'시험 시간 ' + self.exam.text() + ' · 눌러 설정'}
        self.root.title(labels.get(zone, '타이머 002'))
        self.canvas.config(cursor='hand2' if zone else 'arrow')

    def draw(self):
        left = self.exam.target - self.exam.elapsed()
        frame = 'overdue' if left < 0 else f'{round(max(0, min(1, left/self.exam.target))*180):03}'
        if frame != self.current_frame:
            if frame not in self.frames:
                self.frames[frame] = tk.PhotoImage(file=str(HERE / 'frames' / (frame + '.png')))
            self.frames.move_to_end(frame)
            self.canvas.itemconfigure(self.art_id, image=self.frames[frame])
            self.current_frame = frame
            while len(self.frames) > 16:
                self.frames.popitem(last=False)
        target_minutes = self.exam.target // 60
        target_text = f'{target_minutes}분' if self.exam.target % 60 == 0 else self.exam.text()
        self.canvas.itemconfigure(self.exam_target_id, text=target_text)
        text = self.problem.text().replace(':', ' : ')
        self.canvas.itemconfigure(self.problem_label_id, fill=self.accent)
        self.canvas.itemconfigure(self.text_id, text=text,
                                  fill='#f26b46' if self.problem.elapsed() > self.problem.target else self.accent,
                                  font=('Segoe UI', -31 if len(text) <= 8 else -25, 'bold'))

    def apply_accent_color(self, color):
        old_color = self.accent
        self.status.config(text='새 색상을 적용하는 중입니다…')
        self.status.pack(padx=8, pady=(0, 8))
        self.root.update_idletasks()
        try:
            from build_artwork import build_assets
            build_assets(color)
        except (ImportError, OSError, ValueError) as error:
            self.data['accentColor'] = old_color
            core.save_settings(self.data)
            self.status.config(text='색상을 적용하지 못했습니다: ' + str(error))
            return
        self.accent = color
        core.RED = color
        self.frames.clear()
        self.current_frame = None
        self.canvas.itemconfigure(self.problem_label_id, fill=color)
        self.canvas.itemconfigure(self.text_id, fill=color)
        try:
            self.root.iconbitmap(default=ICON)
            configure_tk_window(self.root, __file__, ICON)
        except OSError:
            pass
        self.status.config(text='')
        self.status.pack_forget()


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
