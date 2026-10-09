"""Rebuild the original pixel art and synthesized sound effects. Requires Pillow.
The shipped Godot game needs no Python or other external runtime.
"""
from pathlib import Path
import math
import random
import struct
import wave
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
ASSETS.mkdir(exist_ok=True)
(ASSETS / 'audio').mkdir(exist_ok=True)
rng = random.Random(19)

def canvas(w, h):
    im = Image.new('RGBA', (w, h))
    return im, ImageDraw.Draw(im)

def save(im, name):
    im.save(ASSETS / (name + '.png'))

# Stone: small chips, a moss lip, and dark undersides read at native resolution.
for name, top in [('stone', True), ('stone_fill', False)]:
    im, d = canvas(16, 16)
    d.rectangle((0, 0, 15, 15), fill='#192e30')
    d.rectangle((1, 2, 14, 13), fill='#3c6250' if top else '#2f4940')
    d.line((1, 3, 14, 3), fill='#65875e' if top else '#49664e')
    d.line((1, 13, 14, 13), fill='#223c35')
    d.line((14, 4, 14, 12), fill='#2b4c40')
    d.point((3, 6), fill='#74946a')
    d.line((8, 8, 11, 8), fill='#2d4b3e')
    d.point((6, 11), fill='#50745a')
    if top:
        d.rectangle((0, 0, 15, 1), fill='#91af6d')
        d.line((0, 2, 15, 2), fill='#588756')
        d.line((3, 0, 5, 0), fill='#c0cd8b')
        d.rectangle((11, 2, 12, 4), fill='#6e995b')
    save(im, name)

im, d = canvas(32, 32)
d.rectangle((0, 0, 31, 31), fill='#242d29')
d.rectangle((2, 2, 29, 29), fill='#a4703e')
for x in (5, 13, 21):
    d.rectangle((x, 4, x+5, 27), fill='#785031')
    d.line((x+1, 5, x+1, 26), fill='#c08b4c')
    d.line((x+3, 8, x+3, 24), fill='#8c6038')
d.rectangle((2, 2, 29, 5), fill='#c18b4c')
d.rectangle((2, 26, 29, 29), fill='#67452d')
d.line((4, 7, 25, 25), fill='#d19a54', width=4)
d.line((6, 7, 27, 25), fill='#8b5c34', width=2)
for x, y in ((4, 3), (27, 3), (4, 28), (27, 28)):
    d.rectangle((x, y, x+1, y+1), fill='#ddd0a1')
save(im, 'crate')

im, d = canvas(16, 16)
d.rectangle((1, 0, 3, 15), fill='#6a4e36')
d.rectangle((12, 0, 14, 15), fill='#6a4e36')
d.line((1, 0, 1, 15), fill='#b99458')
d.line((12, 0, 12, 15), fill='#b99458')
for y in (3, 11):
    d.rectangle((3, y, 12, y+2), fill='#ae8451')
    d.line((3, y+2, 12, y+2), fill='#473d2c')
save(im, 'ladder')

im, d = canvas(24, 20)
d.ellipse((1, 2, 11, 12), fill='#5d482e')
d.ellipse((2, 1, 12, 11), fill='#f3c95d')
d.ellipse((5, 4, 9, 8), fill='#173037')
d.line((10, 10, 19, 17), fill='#f3c95d', width=3)
d.rectangle((17, 12, 20, 14), fill='#f3c95d')
d.rectangle((20, 15, 22, 17), fill='#bf8d39')
d.line((4, 2, 8, 2), fill='#fff1b0')
save(im, 'key')

for name, is_open in [('door', False), ('door_open', True)]:
    im, d = canvas(40, 56)
    d.rounded_rectangle((0, 0, 39, 55), radius=10, fill='#172d2f')
    d.rounded_rectangle((2, 2, 37, 55), radius=9, fill='#486453')
    d.rounded_rectangle((5, 5, 34, 55), radius=8, fill='#9d7d4f')
    d.rounded_rectangle((7, 7, 32, 55), radius=7, fill='#3b3229' if is_open else '#91623b')
    if is_open:
        d.rectangle((9, 18, 27, 55), fill='#e1c784')
        d.rectangle((11, 15, 25, 55), fill='#f7dfa1')
        d.polygon([(8, 10), (15, 14), (15, 54), (8, 55)], fill='#774a32')
    else:
        for x in (10, 16, 22, 28):
            d.line((x, 12, x, 53), fill='#4d392d')
            d.line((x+1, 12, x+1, 53), fill='#bd8550')
        for y in (23, 43):
            d.rectangle((7, y, 32, y+3), fill='#363f36')
            d.point((9, y+1), fill='#b8b695')
            d.point((30, y+1), fill='#b8b695')
        d.rectangle((23, 31, 29, 38), fill='#e7bb54')
        d.rectangle((25, 33, 26, 36), fill='#4e3e2a')
    for y in (18, 34, 50):
        d.line((1, y, 5, y), fill='#213d38')
        d.line((34, y, 38, y), fill='#213d38')
    save(im, name)

for name, accent in [('ferry', '#80c8c4'), ('lift', '#efd077')]:
    im, d = canvas(64, 16)
    d.rectangle((0, 0, 63, 11), fill='#203b3d')
    d.rectangle((2, 1, 61, 9), fill='#68856b')
    d.rectangle((0, 0, 63, 1), fill=accent)
    d.rectangle((3, 4, 60, 7), fill='#3a544b')
    for x in range(6, 62, 12):
        d.rectangle((x, 4, x+3, 7), fill='#c6aa66')
    d.polygon([(5, 12), (15, 12), (10, 15)], fill='#344e45')
    d.polygon([(48, 12), (58, 12), (53, 15)], fill='#344e45')
    save(im, name)

im, d = canvas(32, 16)
for x in (0, 11, 22):
    d.polygon([(x, 15), (x+5, 1), (x+10, 15)], fill='#1f3739')
    d.polygon([(x+1, 14), (x+5, 2), (x+8, 14)], fill='#92b8b0')
    d.line((x+5, 3, x+3, 12), fill='#d1ded0')
d.rectangle((0, 14, 31, 15), fill='#3f5b51')
save(im, 'spikes')

# Six original animation cells, at 16 x 24 pixels each.
im, d = canvas(96, 24)
for frame in range(6):
    x = frame * 16
    bob = 1 if frame in (1, 3) else 0
    d.rectangle((x+4, 4+bob, x+12, 12+bob), fill='#263d35')
    d.rectangle((x+5, 5+bob, x+11, 11+bob), fill='#dab684')
    d.rectangle((x+3, 3+bob, x+12, 5+bob), fill='#6ca059')
    d.rectangle((x+5, 1+bob, x+10, 3+bob), fill='#83b566')
    d.rectangle((x+11, 4+bob, x+14, 5+bob), fill='#a7c978')
    d.point((x+10, 8+bob), fill='#1e2a2b')
    d.rectangle((x+3, 12+bob, x+11, 19), fill='#487c4e')
    d.line((x+4, 13+bob, x+4, 17), fill='#8ab265')
    d.rectangle((x+2, 13+bob, x+4, 17+bob), fill='#876646')
    d.rectangle((x+4, 18, x+11, 19), fill='#bd9655')
    if frame == 2:
        legs = [(4, 20, 6, 23), (10, 20, 13, 22)]
    elif frame in (3, 5):
        legs = [(3, 20, 6, 22), (9, 20, 11, 23)]
    elif frame == 4:
        legs = [(3, 19, 6, 21), (10, 19, 13, 21)]
    else:
        legs = [(4, 20, 6, 23), (9, 20, 11, 23)]
    for a,b,c,e in legs:
        d.rectangle((x+a, b, x+c, e), fill='#423d32')
        d.line((x+a, e, x+c+1, e), fill='#ae8050')
    d.rectangle((x+11, 13+bob, x+13, 17+bob), fill='#dab684')
    if frame == 5:
        d.rectangle((x+2, 10, x+4, 13), fill='#dab684')
        d.rectangle((x+11, 10, x+13, 13), fill='#dab684')
save(im, 'adventurer')

im, d = canvas(64, 32)
for f in range(4):
    x = f*16
    d.rectangle((x+6, 18, x+9, 30), fill='#65442e')
    d.rectangle((x+4, 18, x+11, 20), fill='#b59158')
    d.polygon([(x+4, 17), (x+3, 10), (x+6, 12), (x+7+f%2, 3), (x+10, 10), (x+12, 9+f), (x+11, 16)], fill='#dd7839')
    d.polygon([(x+5, 16), (x+7, 9+f), (x+10, 13), (x+10, 17)], fill='#f6c566')
    d.rectangle((x+7, 14, x+8, 17), fill='#fff2ad')
save(im, 'torch')
im, d = canvas(96, 96)
for radius in range(47, 0, -1):
    alpha = int(48 * (1-radius/48)**2)
    d.ellipse((48-radius, 48-radius, 48+radius, 48+radius), fill=(247,170,71,alpha))
save(im, 'glow')

im, d = canvas(32, 96)
for stem in (8, 22):
    length = 82 if stem == 8 else 57
    pts = [(stem + int(math.sin(y*.18)*2), y) for y in range(length)]
    d.line(pts, fill='#456c4a', width=1)
    for y in range(5, length, 8):
        x = stem+int(math.sin(y*.18)*2)
        d.polygon([(x,y),(x-6,y-3),(x-5,y+2),(x,y+3)], fill='#548454')
        d.polygon([(x,y+2),(x+5,y),(x+4,y+5),(x,y+5)], fill='#355f45')
save(im, 'vines')

im, d = canvas(768, 432)
d.rectangle((0,0,767,431), fill='#0d222a')
for row, y in enumerate(range(32,432,16)):
    for x in range(-32 if row%2 else -16,768,32):
        c = rng.choice(['#17333a','#18343b','#153039','#163139','#19353b'])
        d.rectangle((x+1,y+1,x+30,y+14), fill=c)
        d.line((x+2,y+2,x+29,y+2), fill='#1d3b40')
        if rng.random() < .20:
            d.line((x+8,y+8,x+12,y+8),fill='#214047')
# Broad quiet wall recesses, masonry frames, moss drips and old stone sigils.
for x,y,w,h in ((47,112,105,99),(328,69,112,85),(586,65,126,62)):
    d.rectangle((x,y,x+w,y+h),outline='#264347',width=3)
    d.rectangle((x+5,y+5,x+w-5,y+h-5),fill='#102a32')
    for yy in range(y+10,y+h-4,12):
        d.line((x+7,yy,x+w-7,yy),fill='#153239')
    d.line((x+5,y+h-4,x+w-4,y+h-4),fill='#38544c')
    cx,cy=x+w//2,y+h//2
    d.line((cx-10,cy,cx,cy-12,cx+10,cy,cx,cy+12,cx-10,cy),fill='#2c4b4d',width=2)
    d.rectangle((cx-2,cy-2,cx+2,cy+2),fill='#477064')
for x in (25,742):
    d.rectangle((x-5,32,x+4,431),fill='#203b3b')
    for y in range(32,432,16):
        d.rectangle((x-4,y+1,x+3,y+14),fill='#2e4a43')
        d.line((x-3,y+2,x+2,y+2),fill='#4a6750')
# Guide rails sit behind the two moving platforms.
d.line((472,308,610,308), fill='#294947',width=3)
for x in range(476,612,12):
    d.point((x,308),fill='#6a8979')
d.rectangle((653,152,658,278),fill='#294947')
for y in range(156,279,12):
    d.line((654,y,657,y),fill='#779073')
d.rectangle((648,137,663,141),fill='#a69057')
for x in (16,150,226,452,552,718):
    vine=Image.open(ASSETS/'vines.png')
    im.alpha_composite(vine,(x,32))
for _ in range(95):
    x,y=rng.randrange(35,735),rng.randrange(64,412)
    d.point((x,y),fill=rng.choice(['#254349','#214047','#304b49']))
# Low rubble and dark pit depths.
for x in range(450,704,8):
    d.rectangle((x,426-rng.randrange(6),x+6,431),fill='#223a39')
save(im, 'dungeon_background')
icon=Image.open(ASSETS/'adventurer.png').crop((0,0,16,24)).resize((64,96),Image.Resampling.NEAREST)
im,d=canvas(128,128)
d.rounded_rectangle((0,0,127,127),radius=16,fill='#142d33')
d.rectangle((8,8,119,119),outline='#7d9e68',width=4)
im.alpha_composite(icon,(32,16))
save(im,'icon')

def sound(name, notes, duration, volume=0.25, noise=False):
    sample_rate=22050
    samples=[]
    for i in range(int(duration*sample_rate)):
        t=i/sample_rate
        progress=t/duration
        frequency=notes[min(len(notes)-1,int(progress*len(notes)))]
        envelope=min(1,t*150)*(1-progress)**1.5
        value=(1 if math.sin(t*frequency*math.tau)>0 else -1)*0.6
        value += math.sin(t*frequency*math.tau*0.5)*0.2
        if noise: value+=rng.uniform(-0.5,0.5)*progress
        samples.append(struct.pack('<h',int(value*envelope*volume*32767)))
    with wave.open(str(ASSETS/'audio'/f'{name}.wav'),'wb') as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(sample_rate)
        f.writeframes(b''.join(samples))
sound('jump',[240,330,440],.15,.14)
sound('key',[660,880,1100,1320],.4)
sound('locked',[155,130],.18,.18)
sound('death',[280,220,150,80],.4,.23,True)
sound('win',[523,659,784,1047,784,1047],.9,.21)
print('Original PNG sprites, dungeon art, and WAV sounds generated.')
