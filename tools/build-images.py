from PIL import Image, ImageFilter
import os
SRC="E:/Ai web 2"; OUT="E:/Ai web 2/assets/projects"
os.makedirs(OUT, exist_ok=True)

def crop_ratio(im, ratio, anchor=0.5):
    w,h = im.size; cur = w/h
    if abs(cur-ratio) < 0.005: return im
    if cur > ratio:                      # too wide -> crop sides
        nw = int(round(h*ratio)); x = int(round((w-nw)*anchor))
        return im.crop((x,0,x+nw,h))
    nh = int(round(w/ratio)); y = int(round((h-nh)*anchor))
    return im.crop((0,y,w,y+nh))

def save(im, path, w, ratio, anchor=0.5, q=80):
    im = crop_ratio(im, ratio, anchor)
    h = int(round(w/ratio))
    im = im.convert("RGB").resize((w,h), Image.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=1.0, percent=52, threshold=3))
    im.save(path, "WEBP", quality=q, method=6)
    return os.path.getsize(path)

# role: (file, outname, ratio, anchor)
JOBS = {
 "lima": [
   ("Lima Cabin/front view.jpg",       "lima-main", 0.8, 0.5),
   ("Lima Cabin/human view.jpg",       "lima-sub",  1.0, 0.5),
   ("Lima Cabin/Lima cabin (10).jpg",  "lima-g1",   0.8, 0.45),
   ("Lima Cabin/bed.jpg",              "lima-g2",   0.8, 0.5),
   ("Lima Cabin/Lima cabin (9).jpg",   "lima-g3",   0.8, 0.5),
   ("Lima Cabin/Lima cabin (1).jpg",   "lima-g4",   0.8, 0.5),
 ],
 "maverick": [
   ("Maverick Cabin/2_Aerial.jpg",                     "maverick-main", 0.8, 0.5),
   ("Maverick Cabin/2_Photo - 6.jpg",                  "maverick-sub",  1.0, 0.5),
   ("Maverick Cabin/30000-gigapixel-hq-scale-2_00x.jpg","maverick-g1",  0.8, 0.5),
   ("Maverick Cabin/10000-gigapixel-hq-scale-2_00x (1).jpg","maverick-g2",0.8,0.5),
   ("Maverick Cabin/70000-gigapixel-hq-scale-2_00x.jpg","maverick-g3",  0.8, 0.5),
   ("Maverick Cabin/2_11 - Photo.jpg",                 "maverick-g4",   0.8, 0.5),
 ],
 "puzzle": [
   ("Puzzle Cabin/ambiguous (4).jpg", "puzzle-main", 0.8, 0.5),
   ("Puzzle Cabin/ambiguous (2).jpg", "puzzle-sub",  1.0, 0.5),
   ("Puzzle Cabin/ambiguous (3).jpg", "puzzle-g1",   0.8, 0.5),
   ("Puzzle Cabin/ambiguous (8).jpg", "puzzle-g2",   0.8, 0.5),
   ("Puzzle Cabin/ambiguous (9).jpg", "puzzle-g3",   0.8, 0.5),
   ("Puzzle Cabin/ambiguous (4).jpg", "puzzle-g4",   0.8, 0.22),
 ],
}
SIZES = {"main":[("",1240),("@sm",760)], "sub":[("",900),("@sm",560)],
         "g":[("",640),("@sm",400)]}
total=0
for proj, jobs in JOBS.items():
    for f,name,ratio,anchor in jobs:
        im = Image.open(os.path.join(SRC,f))
        role = "main" if name.endswith("main") else ("sub" if name.endswith("sub") else "g")
        for suf,w in SIZES[role]:
            n = save(im.copy(), f"{OUT}/{name}{suf}.webp", w, ratio, anchor)
            total += n
        print(f"  {name:16s} {im.size} -> {ratio}")
print(f"TOTAL {total/1048576:.2f} MB")
