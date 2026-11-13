#!/usr/bin/env python3
"""
Cuts the heads out of the Universal Base Characters kit by Quaternius (CC0, https://quaternius.com) and writes
them where the game can load them: public/models/people/heads.json and three small pictures beside it.

A one-off: run it only to rebuild those files from the kit. It needs Python with numpy and Pillow, and the free
"Standard" edition of the kit unpacked somewhere:

    python3 scripts/heads.py "/path/to/Universal Base Characters[Standard]"

What is kept of each of the two figures (a man and a woman): the skin of the head and upper neck, the eyes, and
the eyebrows; and the kit's beard and five heads of hair. Everything stays in the kit's own space (metres, +y up, +z the way the face
looks); the game fits each head to its own figure. The skin's picture is divided by the face's average colour,
so that in the game it can be multiplied by any skin colour at all.
"""
import json, sys, os
import numpy as np
from PIL import Image

KIT = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'models', 'people')
CT = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
N = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def load(path):
    g = json.load(open(path)); base = os.path.dirname(path)
    bufs = [open(os.path.join(base, b['uri']), 'rb').read() for b in g['buffers']]
    def acc(i):
        a = g['accessors'][i]; bv = g['bufferViews'][a['bufferView']]; n = N[a['type']]; dt = np.dtype(CT[a['componentType']])
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); stride = bv.get('byteStride', 0)
        if stride and stride != dt.itemsize * n:
            raw = np.frombuffer(bufs[bv['buffer']], dtype=np.uint8, count=stride * a['count'], offset=off).reshape(a['count'], stride)[:, :dt.itemsize * n].copy().view(dt)
            return raw.reshape(a['count'], n)
        return np.frombuffer(bufs[bv['buffer']], dtype=dt, count=a['count'] * n, offset=off).reshape(a['count'], n)
    return g, acc


def piece(g, acc, mesh, keep=None, uv=True):
    """One mesh as plain lists, optionally only the vertices `keep` picks (and the triangles wholly among them)."""
    p = mesh['primitives'][0]
    P = acc(p['attributes']['POSITION']).astype(float); Nn = acc(p['attributes']['NORMAL']).astype(float)
    UV = acc(p['attributes']['TEXCOORD_0']).astype(float); I = acc(p['indices']).reshape(-1, 3).astype(int)
    sel = np.ones(len(P), bool) if keep is None else keep(p, P)
    tri = I[sel[I].all(1)]
    used = np.zeros(len(P), bool); used[tri.ravel()] = True
    remap = -np.ones(len(P), int); remap[used] = np.arange(used.sum())
    out = {'p': np.round(P[used], 4).ravel().tolist(), 'n': np.round(Nn[used], 3).ravel().tolist(), 'i': remap[tri].ravel().tolist()}
    if uv: out['uv'] = np.round(UV[used], 4).ravel().tolist()
    return out, P[used]


def figure(sex, gltf, skin_png, tag):
    g, acc = load(os.path.join(KIT, 'Base Characters', 'Godot - UE', gltf))
    names = [g['nodes'][j]['name'] for j in g['skins'][0]['joints']]; head = names.index('Head')
    def of_head(p, P):
        J = acc(p['attributes']['JOINTS_0']); W = acc(p['attributes']['WEIGHTS_0']).astype(float)
        if W.max() > 1.5: W = W / W.max()
        return (W * (J == head)).sum(1) > 0.3
    meshes = sorted(g['meshes'], key=lambda m: len(acc(m['primitives'][0]['attributes']['POSITION'])))
    body = meshes[-1]
    eyes = next(m for m in g['meshes'] if g['materials'][m['primitives'][0]['material']]['name'] == 'MI_Eyes')
    brows = next(m for m in g['meshes'] if m is not body and m is not eyes)
    skin, P = piece(g, acc, body, of_head)
    e, EP = piece(g, acc, eyes); b, _ = piece(g, acc, brows)
    # The skin's picture, made a matter of light and shade and blush only: divided by the colour of the face, and halved so nothing clips.
    im = np.asarray(Image.open(os.path.join(KIT, 'Base Characters', 'Textures', skin_png)).convert('RGB').resize((1024, 1024), Image.LANCZOS)).astype(float) / 255
    lin = np.where(im <= 0.04045, im / 12.92, ((im + 0.055) / 1.055) ** 2.4)
    mean = lin[120:300, 60:330].reshape(-1, 3).mean(0)  # the cheeks and brow of the face, top left of the sheet
    rel = np.clip(lin / mean * 0.5, 0, 1)
    srgb = np.where(rel <= 0.0031308, rel * 12.92, 1.055 * rel ** (1 / 2.4) - 0.055)
    Image.fromarray((srgb * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, 'head_%s.webp' % tag), quality=82, method=6)
    return {'skin': skin, 'eyes': e, 'brows': b, 'crown': round(float(P[:, 1].max()), 4), 'eyeY': round(float((EP[:, 1].min() + EP[:, 1].max()) / 2), 4), 'eyeZ': round(float(EP[:, 2].max()), 4), 'half': round(float(P[:, 0].max()), 4)}


out = {'m': figure('m', 'Superhero_Male_FullBody.gltf', 'T_Superhero_Male_Ligh.png', 'm'), 'f': figure('f', 'Superhero_Female_FullBody.gltf', 'T_Superhero_Female_Light_BaseColor.png', 'f')}
def hair(name):
    g, acc = load(os.path.join(KIT, 'Hairstyles', 'Rigged to Head Bone', 'glTF (Godot -Unreal)', name + '.gltf'))
    return piece(g, acc, max(g['meshes'], key=lambda m: len(acc(m['primitives'][0]['attributes']['POSITION']))))[0]


# The beard and the two short cuts are fitted to the man's head; the long hair, the buns and the other short cut to the woman's.
out['beard'] = hair('Hair_Beard')
out['hair'] = {'parted': hair('Hair_SimpleParted'), 'buzzed': hair('Hair_Buzzed'), 'buzzedF': hair('Hair_BuzzedFemale'), 'long': hair('Hair_Long'), 'buns': hair('Hair_Buns')}
# The hair's two pictures, kept as light and shade only (the strands), so the game can give hair any colour.
for k in (1, 2):
    im = np.asarray(Image.open(os.path.join(KIT, 'Hairstyles', 'Textures', 'T_Hair_%d_BaseColor.png' % k)).convert('RGB').resize((512, 512), Image.LANCZOS)).astype(float) / 255
    lin = np.where(im <= 0.04045, im / 12.92, ((im + 0.055) / 1.055) ** 2.4) @ np.array([0.2126, 0.7152, 0.0722])
    rel = np.clip(lin / lin.mean() * 0.5, 0, 1)
    srgb = np.where(rel <= 0.0031308, rel * 12.92, 1.055 * rel ** (1 / 2.4) - 0.055)
    Image.fromarray((srgb * 255 + 0.5).astype(np.uint8), 'L').convert('RGB').save(os.path.join(OUT, 'hair_%d.webp' % k), quality=80, method=6)
Image.open(os.path.join(KIT, 'Base Characters', 'Textures', 'T_Eye_Brown.png')).convert('RGB').save(os.path.join(OUT, 'eye.webp'), quality=90)
json.dump(out, open(os.path.join(OUT, 'heads.json'), 'w'), separators=(',', ':'))
print({k: len(v['p']) // 3 for k, v in out['hair'].items()}, len(out['beard']['p']) // 3)
