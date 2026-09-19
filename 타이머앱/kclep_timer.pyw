import ctypes, ctypes.wintypes as wt, json, os, queue, threading, time, tkinter as tk

HERE = os.path.dirname(os.path.abspath(__file__))
SETTINGS = os.path.join(HERE, 'timer-settings.json')
RED, DARK, BG, TRACK, INK = '#e53935', '#7a1010', '#ffffff', '#edf2f6', '#15345e'
BTN = dict(bg='#f4f8fc', fg='#23445f', activebackground='#e6eef6', relief='solid', bd=1, font=('맑은 고딕', 10), cursor='hand2')

MOD_ALT, MOD_CONTROL, MOD_NOREPEAT, WM_HOTKEY = 0x1, 0x2, 0x4000, 0x0312
HOTKEYS = {1: ((MOD_CONTROL, 0x20), 'Ctrl+Space', 'toggle'),
           2: ((MOD_CONTROL | MOD_ALT, 0x52), 'Ctrl+Alt+R', 'reset')}
FALLBACK = {1: ((MOD_CONTROL | MOD_ALT, 0x20), 'Ctrl+Alt+Space')}


def load():
    try:
        with open(SETTINGS, encoding='utf-8') as f:
            return max(1, int(json.load(f).get('targetSeconds', 60)))
    except Exception:
        return 60


def save(seconds):
    with open(SETTINGS, 'w', encoding='utf-8') as f:
        json.dump({'targetSeconds': seconds}, f)


class Timer:
    def __init__(self, root):
        self.root, self.target = root, load()
        self.started = self.paused_at = None
        self.paused_total = 0.0
        self.events, self.labels = queue.Queue(), {}
        root.title('타이머')
        root.configure(bg=BG)
        root.attributes('-topmost', True)
        root.resizable(False, False)

        self.canvas = tk.Canvas(root, width=150, height=150, bg=BG, highlightthickness=0, cursor='hand2')
        self.canvas.pack(padx=14, pady=(14, 8))
        self.canvas.bind('<Button-1>', lambda e: self.toggle())

        pair = tk.Frame(root, bg=BG)
        pair.pack(fill='x', padx=14)
        self.pause_btn = tk.Button(pair, text='❚❚', command=self.pause, **BTN)
        self.resume_btn = tk.Button(pair, text='▶', command=self.resume, **BTN)
        self.pause_btn.pack(side='left', expand=True, fill='x', padx=(0, 3))
        self.resume_btn.pack(side='left', expand=True, fill='x', padx=(3, 0))
        tk.Button(root, text='초기화', command=self.reset, **BTN).pack(fill='x', padx=14, pady=(6, 0), ipady=3)
        self.config_btn = tk.Button(root, text='설정', command=self.settings, **BTN)
        self.config_btn.pack(fill='x', padx=14, pady=(6, 0), ipady=3)
        self.keys = tk.Label(root, bg=BG, fg='#6b7f92', font=('맑은 고딕', 8), justify='left')
        self.keys.pack(padx=14, pady=(8, 12), anchor='w')

        threading.Thread(target=self.hotkey_loop, daemon=True).start()
        root.after(50, self.tick)

    def elapsed(self):
        if self.started is None:
            return 0.0
        return (self.paused_at or time.monotonic()) - self.started - self.paused_total

    def running(self):
        return self.started is not None and self.paused_at is None

    def toggle(self):
        if self.started is None:
            self.started = time.monotonic()
        elif self.paused_at is None:
            self.pause()
        else:
            self.resume()

    def pause(self):
        if self.running():
            self.paused_at = time.monotonic()

    def resume(self):
        if self.started is not None and self.paused_at is not None:
            self.paused_total += time.monotonic() - self.paused_at
            self.paused_at = None

    def reset(self):
        self.started = self.paused_at = None
        self.paused_total = 0.0

    def draw(self):
        c, left = self.canvas, self.target - self.elapsed()
        c.delete('all')
        over = left < 0
        c.create_oval(8, 8, 142, 142, outline=TRACK, width=20)
        if over:
            c.create_oval(8, 8, 142, 142, outline=DARK, width=20)
        elif left > 0:
            extent = 359.999 * left / self.target
            c.create_arc(8, 8, 142, 142, start=90, extent=extent, style='arc', outline=RED, width=20)
        s = int(abs(left) + (0 if over else 0.999))
        text = ('+' if over else '') + f'{s // 60}:{s % 60:02d}'
        c.create_text(75, 75, text=text, fill=DARK if over else INK, font=('맑은 고딕', 22, 'bold'))
        self.pause_btn.config(state='normal' if self.running() else 'disabled')
        self.resume_btn.config(state='normal' if self.paused_at is not None else 'disabled')
        self.config_btn.config(state='disabled' if self.started is not None else 'normal')

    def tick(self):
        while not self.events.empty():
            kind, payload = self.events.get()
            if kind == 'keys':
                self.keys.config(text=payload)
            elif payload == 'toggle':
                self.toggle()
            elif payload == 'reset':
                self.reset()
        self.draw()
        self.root.after(100, self.tick)

    def settings(self):
        if self.started is not None:
            return
        d = tk.Toplevel(self.root, bg='#f7fbff')
        d.title('타이머 설정')
        d.attributes('-topmost', True)
        d.resizable(False, False)
        d.grab_set()
        row = tk.Frame(d, bg='#f7fbff')
        row.pack(padx=20, pady=(20, 6))
        vals = []
        for label, v in (('분', self.target // 60), ('초', self.target % 60)):
            box = tk.Frame(row, bg='#f7fbff')
            box.pack(side='left', padx=8)
            tk.Label(box, text=label, bg='#f7fbff', fg='#24445c', font=('맑은 고딕', 10)).pack()
            e = tk.Entry(box, width=4, justify='center', font=('맑은 고딕', 24))
            e.insert(0, str(v))
            e.pack()
            vals.append(e)
        err = tk.Label(d, text='', bg='#f7fbff', fg='#b53030', font=('맑은 고딕', 9))
        err.pack()

        def done(_=None):
            try:
                m, s = int(vals[0].get() or 0), int(vals[1].get() or 0)
            except ValueError:
                err.config(text='숫자만 입력하세요')
                return
            total = m * 60 + s
            if total <= 0 or s > 59 or m < 0 or s < 0:
                err.config(text='1초 이상, 초는 0~59')
                return
            self.target = total
            save(total)
            d.destroy()

        tk.Button(d, text='완료', command=done, bg='#fff', fg='#b53030', font=('맑은 고딕', 11, 'bold'),
                  relief='solid', bd=2, cursor='hand2').pack(pady=(4, 18), ipadx=18, ipady=4)
        d.bind('<Return>', done)
        d.bind('<Escape>', lambda e: d.destroy())
        vals[0].focus_set()
        vals[0].select_range(0, 'end')

    def hotkey_loop(self):
        user32 = ctypes.windll.user32
        names = []
        for hid, ((mods, vk), name, _) in HOTKEYS.items():
            if user32.RegisterHotKey(None, hid, mods | MOD_NOREPEAT, vk):
                names.append(name)
            elif hid in FALLBACK:
                (fmods, fvk), fname = FALLBACK[hid]
                if user32.RegisterHotKey(None, hid, fmods | MOD_NOREPEAT, fvk):
                    names.append(fname)
                else:
                    names.append(name + ' 사용 불가')
            else:
                names.append(name + ' 사용 불가')
        self.events.put(('keys', f'{names[0]} : 시작 · 일시정지 · 계속\n{names[1]} : 초기화'))
        msg = wt.MSG()
        while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) != 0:
            if msg.message == WM_HOTKEY and msg.wParam in HOTKEYS:
                self.events.put(('key', HOTKEYS[msg.wParam][2]))


if __name__ == '__main__':
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        pass
    root = tk.Tk()
    Timer(root)
    root.mainloop()
