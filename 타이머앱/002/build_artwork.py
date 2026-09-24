"""Build antialiased clock frames once. Running the timer only needs standard Python/Tk."""
from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
SIZE, SCALE = (240, 292), 4
BG, BLACK, YELLOW = '#eef1f0', '#080a09', '#ffdc00'


def artwork(fraction=1, overdue=False):
    size = tuple(x * SCALE for x in SIZE)
    im = Image.new('RGBA', size, BG)
    shadow = Image.new('RGBA', size)
    pen = ImageDraw.Draw(shadow)
    def box(values): return tuple(round(x * SCALE) for x in values)
    pen.ellipse(box((25, 39, 216, 231)), fill=(0, 0, 0, 58))
    im = Image.alpha_composite(im, shadow.filter(ImageFilter.GaussianBlur(4 * SCALE)))
    pen = ImageDraw.Draw(im)
    pen.rounded_rectangle(box((103, 7, 137, 24)), radius=2*SCALE, fill=BLACK)
    pen.rectangle(box((115, 22, 125, 37)), fill=BLACK)
    # The smaller crown follows the diagonal edge of the stopwatch.
    angle = math.radians(32)
    def tilted(cx, cy, w, h):
        return [(round((cx + x*math.cos(angle) - y*math.sin(angle))*SCALE),
                 round((cy + x*math.sin(angle) + y*math.cos(angle))*SCALE))
                for x, y in ((-w/2,-h/2),(w/2,-h/2),(w/2,h/2),(-w/2,h/2))]
    pen.polygon(tilted(180, 43, 10, 18), fill=BLACK)
    pen.polygon(tilted(185, 33, 20, 12), fill=BLACK)
    pen.ellipse(box((26, 33, 214, 221)), fill=BLACK)
    pen.ellipse(box((36, 43, 204, 211)), fill='#ffffff')
    dial = box((47, 54, 193, 200))
    color = '#f26b46' if overdue else YELLOW
    if fraction >= 1:
        pen.ellipse(dial, fill=color)
    elif fraction > 0:
        pen.pieslice(dial, start=-90, end=-90 + 360*fraction, fill=color)
    for degrees in range(0, 360, 60):
        a = math.radians(degrees - 90)
        x, y = 120 + 77*math.cos(a), 127 + 77*math.sin(a)
        pen.ellipse(box((x-3,y-3,x+3,y+3)), fill=BLACK)
    a = math.radians(360*fraction - 90)
    end = (120 + 48*math.cos(a), 127 + 48*math.sin(a))
    pen.line([box((120,127)),box(end)], fill=BLACK, width=7*SCALE)
    pen.ellipse(box((end[0]-3.5,end[1]-3.5,end[0]+3.5,end[1]+3.5)), fill=BLACK)
    pen.ellipse(box((110,117,130,137)), fill=BLACK)
    pen.ellipse(box((116,123,124,131)), fill='#ffffff')
    pen.rounded_rectangle(box((27,232,213,285)), radius=17*SCALE, fill=BLACK)
    return im.resize(SIZE, Image.Resampling.LANCZOS)


if __name__ == '__main__':
    folder = HERE / 'frames'
    folder.mkdir(exist_ok=True)
    for step in range(181):
        artwork(step / 180).save(folder / f'{step:03}.png')
    artwork(1, True).save(folder / 'overdue.png')
    preview = artwork()
    font = ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf', 34)
    ImageDraw.Draw(preview).text((120,257), '60 : 00', font=font, anchor='mm', fill=YELLOW)
    preview.save(HERE / 'preview.png')
    icon = artwork().crop((21, 0, 219, 226))
    square = Image.new('RGBA', (240,240), BG)
    square.alpha_composite(icon, ((240-icon.width)//2, (240-icon.height)//2))
    square.save(HERE / 'timer002.ico', sizes=[(s,s) for s in (16,24,32,48,64,128,256)])
    print('182 clock frames, icon and preview created.')
