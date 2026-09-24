import ctypes
import ctypes.wintypes as wt
import json
import math
import os
import queue
import threading
import time
import tkinter as tk
from windows_taskbar import configure_tk_window, set_process_identity


HERE = os.path.dirname(os.path.abspath(__file__))
SETTINGS = os.path.join(HERE, 'timer-settings.json')
ICON = os.path.join(HERE, 'study-timer.ico')
WHITE, PALE, BLUE, INK = '#ffffff', '#f3f6fa', '#123e77', '#092d64'
RED, DARK_RED, TRACK = '#ff5357', '#c33446', '#dfe7f1'
MUTED = '#77879c'
MOD_ALT, MOD_CTRL, MOD_SHIFT, MOD_NOREPEAT = 1, 2, 4, 0x4000
WM_HOTKEY, WM_CHANGE, WM_QUIT = 0x0312, 0x8001, 0x0012
LABELS = {
    'problem_toggle': '문제 시작·일시정지',
    'problem_reset': '문제 초기화',
    'exam_toggle': '시험 시작·일시정지',
    'exam_reset': '시험 초기화',
    'settings_open': '설정 창 열기',
}
DEFAULT_KEYS = {
    'problem_toggle': 'Ctrl+Space',
    'problem_reset': 'Ctrl+Alt+R',
    'exam_toggle': 'Ctrl+Space',
    'exam_reset': 'Ctrl+Alt+Shift+R',
    'settings_open': 'Ctrl+,',
}


def parse_key(combo):
    parts = combo.split('+')
    key, mods = parts[-1].upper(), parts[:-1]
    if len(set(mods)) != len(mods) or not set(mods) <= {'Ctrl', 'Alt', 'Shift'}:
        raise ValueError('지원하지 않는 단축키입니다')
    if not ({'Ctrl', 'Alt'} & set(mods)):
        raise ValueError('Ctrl 또는 Alt를 함께 누르세요')
    if key == 'SPACE':
        vk = 0x20
    elif key == ',':
        vk = 0xBC  # VK_OEM_COMMA
    elif len(key) == 1 and key in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789':
        vk = ord(key)
    elif key.startswith('F') and key[1:].isdigit() and 1 <= int(key[1:]) <= 12:
        vk = 0x70 + int(key[1:]) - 1
    else:
        raise ValueError('영문·숫자·쉼표·Space·F1~F12를 사용하세요')
    flags = (MOD_CTRL if 'Ctrl' in mods else 0) | (MOD_ALT if 'Alt' in mods else 0)
    return flags | (MOD_SHIFT if 'Shift' in mods else 0), vk


def load_settings():
    try:
        with open(SETTINGS, encoding='utf-8') as file:
            saved = json.load(file)
        if not isinstance(saved, dict):
            saved = {}
    except (OSError, ValueError):
        saved = {}
    result = {'targetSeconds': 60, 'examTargetSeconds': 3600, 'hotkeys': DEFAULT_KEYS.copy()}
    for name in ('targetSeconds', 'examTargetSeconds'):
        try:
            result[name] = max(1, int(saved.get(name, result[name])))
        except (ValueError, TypeError):
            pass
    incoming = saved.get('hotkeys')
    if isinstance(incoming, dict):
        for action, combo in incoming.items():
            if action in result['hotkeys'] and isinstance(combo, str):
                try:
                    parse_key(combo)
                    result['hotkeys'][action] = combo
                except ValueError:
                    pass
    # Both start/pause rows represent one shared shortcut, including old settings files.
    result['hotkeys']['exam_toggle'] = result['hotkeys']['problem_toggle']
    return result


def save_settings(settings):
    with open(SETTINGS, 'w', encoding='utf-8') as file:
        json.dump(settings, file, ensure_ascii=False, indent=2)


class Clock:
    def __init__(self, seconds):
        self.target = seconds
        self.reset()

    def reset(self):
        self.started = self.paused_at = None
        self.paused_total = 0.0

    def running(self):
        return self.started is not None and self.paused_at is None

    def start(self, now=None):
        now = time.monotonic() if now is None else now
        if self.started is None:
            self.started = now
        elif self.paused_at is not None:
            self.paused_total += now - self.paused_at
            self.paused_at = None

    def pause(self, now=None):
        if self.running():
            self.paused_at = time.monotonic() if now is None else now

    def toggle(self):
        self.pause() if self.running() else self.start()

    def elapsed(self):
        if self.started is None:
            return 0.0
        end = self.paused_at if self.paused_at is not None else time.monotonic()
        return end - self.started - self.paused_total

    def text(self):
        remaining = self.target - self.elapsed()
        overdue = remaining < 0
        seconds = int(abs(remaining) + (0 if overdue else 0.999))
        return ('+' if overdue else '') + f'{seconds // 60}:{seconds % 60:02d}'


class Timer:
    def __init__(self, root):
        self.root = root
        self.data = load_settings()
        self.problem = Clock(self.data['targetSeconds'])
        self.exam = Clock(self.data['examTargetSeconds'])
        self.events, self.key_commands = queue.Queue(), queue.Queue()
        self.key_ready = threading.Event()
        self.key_thread_id = None
        root.title('타이머')
        root.configure(bg=PALE)
        if os.path.isfile(ICON):
            root.iconbitmap(default=ICON)
        root.attributes('-topmost', True)
        root.resizable(False, False)

        top = tk.Frame(root, width=232, height=232, bg=PALE)
        top.pack(pady=(3, 0))
        top.pack_propagate(False)
        self.face = tk.Canvas(top, width=206, height=190, bg=PALE, highlightthickness=0, cursor='hand2')
        self.face.place(x=13, y=39)
        self.face.bind('<Button-1>', lambda _e: self.time_dialog('problem'))
        tk.Label(top, text='집중 타이머', bg=PALE, fg=INK,
                 font=('맑은 고딕', -12, 'bold')).place(x=14, y=11)
        self.icon(top, '↻', self.problem.reset).place(x=159, y=5, width=30, height=30)
        self.icon(top, '⚙', self.shortcut_dialog).place(x=195, y=5, width=30, height=30)

        self.exam_face = tk.Canvas(root, width=208, height=79, bg=PALE, highlightthickness=0,
                                   cursor='hand2', takefocus=True)
        self.exam_face.pack(padx=12, pady=(0, 9))
        self.exam_face.bind('<Button-1>', lambda _e: self.time_dialog('exam'))
        self.exam_face.bind('<Return>', lambda _e: self.time_dialog('exam'))
        self.shortcut_hint = tk.Label(root, bg=PALE, fg=MUTED,
                                      font=('맑은 고딕', -10), justify='center')
        self.shortcut_hint.pack(pady=(0, 9))
        self.status = tk.Label(root, text='', bg=PALE, fg=DARK_RED, font=('맑은 고딕', -11), wraplength=210)

        threading.Thread(target=self.hotkey_loop, daemon=True).start()
        root.protocol('WM_DELETE_WINDOW', self.close)
        root.after(50, self.tick)

    @staticmethod
    def icon(parent, text, command):
        button = tk.Button(parent, text=text, command=command, width=2, bg=PALE, fg=INK,
                           activebackground=TRACK, activeforeground=RED, relief='flat', bd=0,
                           font=('Segoe UI Symbol', -19), cursor='hand2')
        button.bind('<Enter>', lambda _e: button.config(bg=TRACK))
        button.bind('<Leave>', lambda _e: button.config(bg=PALE))
        return button

    @staticmethod
    def rounded_card(canvas, x1, y1, x2, y2, radius, color):
        canvas.create_polygon(x1 + radius, y1, x2 - radius, y1, x2, y1, x2, y1 + radius,
                              x2, y2 - radius, x2, y2, x2 - radius, y2, x1 + radius, y2,
                              x1, y2, x1, y2 - radius, x1, y1 + radius, x1, y1,
                              smooth=True, splinesteps=24, fill=color, outline='')

    @staticmethod
    def clock_status(clock):
        if clock.elapsed() > clock.target:
            return '시간 초과'
        if clock.running():
            return '진행 중'
        return '일시정지' if clock.started is not None else '준비'

    def toggle_both(self):
        now = time.monotonic()
        if self.problem.running() and self.exam.running():
            self.problem.pause(now)
            self.exam.pause(now)
        else:
            self.problem.start(now)
            self.exam.start(now)

    def draw(self):
        face = self.face
        face.delete('all')
        remaining = self.problem.target - self.problem.elapsed()
        face.create_oval(17, 8, 189, 180, fill='#e7edf5', outline='')
        face.create_oval(17, 5, 189, 177, fill=WHITE, outline='')
        face.create_oval(25, 13, 181, 169, outline=TRACK, width=13)
        if remaining < 0:
            face.create_oval(25, 13, 181, 169, outline=DARK_RED, width=13)
        elif remaining > 0:
            extent = 359.999 * min(remaining / self.problem.target, 1)
            face.create_arc(25, 13, 181, 169, start=90, extent=extent,
                            style='arc', outline=RED, width=13)
            for angle in (90, 90 + extent):
                x = 103 + 78 * math.cos(math.radians(angle))
                y = 91 - 78 * math.sin(math.radians(angle))
                face.create_oval(x - 6.5, y - 6.5, x + 6.5, y + 6.5, fill=RED, outline='')
        face.create_text(103, 60, text='문제 타이머', fill=MUTED, font=('맑은 고딕', -11))
        face.create_text(103, 91, text=self.problem.text(), fill=DARK_RED if remaining < 0 else INK,
                         font=('Segoe UI', -32 if len(self.problem.text()) <= 6 else -24, 'bold'))
        face.create_text(103, 122, text=self.clock_status(self.problem),
                         fill=RED if self.problem.running() else MUTED, font=('맑은 고딕', -10))
        self.shortcut_hint.config(text=self.data['hotkeys']['problem_toggle'] + ' · 시작 / 일시정지\n시간을 누르면 설정')
        card = self.exam_face
        card.delete('all')
        self.rounded_card(card, 0, 0, 208, 79, 18, INK)
        card.create_text(17, 18, text='시험 타이머', anchor='w', fill='#b8c9e3', font=('맑은 고딕', -10))
        card.create_text(191, 18, text=self.clock_status(self.exam), anchor='e',
                         fill='#ff9294' if self.exam.running() else '#b8c9e3', font=('맑은 고딕', -10))
        card.create_text(104, 49, text=self.exam.text(),
                         fill='#ff9294' if self.exam.elapsed() > self.exam.target else WHITE,
                         font=('Segoe UI', -29 if len(self.exam.text()) <= 7 else -23, 'bold'))

    def tick(self):
        while not self.events.empty():
            kind, value = self.events.get()
            if kind == 'action':
                if value == 'problem_toggle':
                    self.toggle_both()
                elif value == 'problem_reset':
                    self.problem.reset()
                elif value == 'exam_reset':
                    self.exam.reset()
                elif value == 'settings_open':
                    self.shortcut_dialog()
            elif kind == 'status':
                self.status.config(text=value)
                if value:
                    self.status.pack(padx=8, pady=(0, 8))
                else:
                    self.status.pack_forget()
        self.draw()
        self.root.after(100, self.tick)

    def time_dialog(self, which):
        clock = self.problem if which == 'problem' else self.exam
        dialog = tk.Toplevel(self.root, bg=PALE)
        dialog.title('문제 타이머 시간 설정' if which == 'problem' else '시험 타이머 시간 설정')
        dialog.attributes('-topmost', True)
        dialog.resizable(False, False)
        dialog.grab_set()
        row = tk.Frame(dialog, bg=PALE)
        row.pack(padx=20, pady=(18, 5))
        fields = []
        for label, value in (('분', clock.target // 60), ('초', clock.target % 60)):
            box = tk.Frame(row, bg=PALE)
            box.pack(side='left', padx=8)
            tk.Label(box, text=label, bg=PALE, fg=INK, font=('맑은 고딕', 10)).pack()
            entry = tk.Entry(box, width=4, justify='center', font=('맑은 고딕', 24),
                             bg=WHITE, fg=INK, insertbackground=INK, relief='flat',
                             highlightthickness=1, highlightbackground=TRACK, highlightcolor=BLUE)
            entry.insert(0, str(value))
            entry.pack()
            fields.append(entry)
        error = tk.Label(dialog, text='', bg=PALE, fg=DARK_RED, font=('맑은 고딕', 9))
        error.pack()

        def done(_event=None):
            try:
                minutes, seconds = (int(field.get() or 0) for field in fields)
            except ValueError:
                error.config(text='숫자만 입력하세요')
                return
            total = minutes * 60 + seconds
            if total <= 0 or minutes < 0 or not 0 <= seconds <= 59:
                error.config(text='1초 이상, 초는 0~59로 입력하세요')
                return
            clock.target = total
            clock.reset()
            self.data['targetSeconds' if which == 'problem' else 'examTargetSeconds'] = total
            save_settings(self.data)
            dialog.destroy()

        tk.Button(dialog, text='완료', command=done, bg=INK, fg=WHITE, activebackground=BLUE,
                  activeforeground=WHITE, font=('맑은 고딕', 11, 'bold'),
                  relief='flat', bd=0, cursor='hand2').pack(pady=(3, 16), ipadx=24, ipady=7)
        dialog.bind('<Return>', done)
        dialog.bind('<Escape>', lambda _e: dialog.destroy())
        fields[0].focus_set()
        fields[0].select_range(0, 'end')

    def change_hotkeys(self, bindings):
        changed = threading.Event()
        self.key_commands.put((bindings, changed))
        if self.key_ready.wait(timeout=1):
            ctypes.windll.user32.PostThreadMessageW(self.key_thread_id, WM_CHANGE, 0, 0)
            changed.wait(timeout=1)

    def shortcut_dialog(self):
        # Suspend global shortcuts while capturing keys, including the shortcuts being changed.
        self.change_hotkeys(None)
        dialog = tk.Toplevel(self.root, bg=PALE)
        dialog.title('단축키 설정')
        dialog.attributes('-topmost', True)
        dialog.resizable(False, False)
        dialog.grab_set()
        draft = self.data['hotkeys'].copy()
        buttons, waiting = {}, [None]
        tk.Label(dialog, text='항목을 누른 뒤 새 단축키를 누르세요.', bg=PALE, fg=INK,
                 font=('맑은 고딕', 10)).pack(padx=15, pady=(14, 8))
        for action, label in LABELS.items():
            row = tk.Frame(dialog, bg=PALE)
            row.pack(fill='x', padx=15, pady=3)
            tk.Label(row, text=label, width=22, anchor='w', bg=PALE, fg=INK,
                     font=('맑은 고딕', 9)).pack(side='left')

            def choose(selected=action):
                waiting[0] = selected
                for item, button in buttons.items():
                    button.config(text='키 입력 대기…' if item == selected else draft[item])
                dialog.focus_force()

            button = tk.Button(row, text=draft[action], command=choose, width=20, bg=WHITE, fg=BLUE,
                               relief='solid', bd=1, font=('맑은 고딕', 9), cursor='hand2')
            button.pack(side='left')
            buttons[action] = button
        error = tk.Label(dialog, text='', bg=PALE, fg=DARK_RED, font=('맑은 고딕', 9))
        error.pack(pady=(4, 0))

        def capture(event):
            if waiting[0] is None:
                if event.keysym == 'Escape':
                    cancel()
                    return 'break'
                return
            key = event.keysym.upper()
            if key in ('CONTROL_L', 'CONTROL_R', 'ALT_L', 'ALT_R', 'SHIFT_L', 'SHIFT_R'):
                return 'break'
            if key == 'ESCAPE':
                buttons[waiting[0]].config(text=draft[waiting[0]])
                waiting[0] = None
                return 'break'
            if key == 'SPACE':
                key = 'Space'
            elif key == 'COMMA':
                key = ','
            user32 = ctypes.windll.user32
            ctrl = bool(user32.GetKeyState(0x11) & 0x8000)
            alt = bool(user32.GetKeyState(0x12) & 0x8000)
            shift = bool(user32.GetKeyState(0x10) & 0x8000)
            parts = [label for label, active in (('Ctrl', ctrl), ('Alt', alt), ('Shift', shift)) if active]
            combo = '+'.join(parts + [key])
            try:
                parse_key(combo)
            except ValueError as exc:
                error.config(text=str(exc))
                return 'break'
            draft[waiting[0]] = combo
            if waiting[0] in ('problem_toggle', 'exam_toggle'):
                draft['problem_toggle'] = draft['exam_toggle'] = combo
                buttons['problem_toggle'].config(text=combo)
                buttons['exam_toggle'].config(text=combo)
            else:
                buttons[waiting[0]].config(text=combo)
            waiting[0] = None
            error.config(text='')
            return 'break'

        def cancel(_event=None):
            self.change_hotkeys(self.data['hotkeys'].copy())
            dialog.destroy()

        def done():
            if waiting[0] is not None:
                error.config(text='단축키 입력을 마치세요')
                return
            unique = (draft['problem_toggle'], draft['problem_reset'],
                      draft['exam_reset'], draft['settings_open'])
            if len(set(unique)) != len(unique):
                error.config(text='시작·중단을 제외한 단축키는 서로 달라야 합니다')
                return
            self.data['hotkeys'] = draft.copy()
            save_settings(self.data)
            self.change_hotkeys(draft.copy())
            dialog.destroy()

        tk.Button(dialog, text='저장', command=done, bg=WHITE, fg=BLUE, font=('맑은 고딕', 10, 'bold'),
                  relief='solid', bd=1, cursor='hand2').pack(pady=(8, 16), ipadx=20, ipady=3)
        dialog.bind('<KeyPress>', capture)
        dialog.protocol('WM_DELETE_WINDOW', cancel)

    def hotkey_loop(self):
        user32 = ctypes.windll.user32
        self.key_thread_id = ctypes.windll.kernel32.GetCurrentThreadId()
        message = wt.MSG()
        user32.PeekMessageW(ctypes.byref(message), None, 0, 0, 0)
        self.key_ready.set()
        # One Windows registration starts/pauses both timers; registering the same key twice fails.
        actions = ('problem_toggle', 'problem_reset', 'exam_reset', 'settings_open')

        def register(bindings):
            for hotkey_id in range(1, len(actions) + 1):
                user32.UnregisterHotKey(None, hotkey_id)
            if bindings is None:
                self.events.put(('status', ''))
                return
            failures = []
            for hotkey_id, action in enumerate(actions, 1):
                combo = bindings[action]
                mods, vk = parse_key(combo)
                if not user32.RegisterHotKey(None, hotkey_id, mods | MOD_NOREPEAT, vk):
                    failures.append(combo)
            self.events.put(('status', '단축키 사용 불가: ' + ', '.join(failures) if failures else ''))

        register(self.data['hotkeys'])
        while user32.GetMessageW(ctypes.byref(message), None, 0, 0) > 0:
            if message.message == WM_HOTKEY and 1 <= message.wParam <= len(actions):
                self.events.put(('action', actions[message.wParam - 1]))
            elif message.message == WM_CHANGE:
                while not self.key_commands.empty():
                    bindings, changed = self.key_commands.get()
                    register(bindings)
                    changed.set()
        register(None)

    def close(self):
        if self.key_ready.is_set():
            ctypes.windll.user32.PostThreadMessageW(self.key_thread_id, WM_QUIT, 0, 0)
        self.root.destroy()


if __name__ == '__main__':
    set_process_identity()
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except (AttributeError, OSError):
        pass
    root = tk.Tk()
    root.withdraw()
    Timer(root)
    configure_tk_window(root, __file__, ICON)
    root.deiconify()
    root.mainloop()
