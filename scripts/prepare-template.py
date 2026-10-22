"""Create a reusable, genuinely redacted template from the user-supplied PDF.
Run only when replacing the reference. Does not retain the original customer/prices.
"""
from pathlib import Path
import sys
import pymupdf as fitz

source=Path(sys.argv[1]); root=Path(__file__).resolve().parents[1]
doc=fitz.open(source)
(root/'public/templates').mkdir(parents=True,exist_ok=True)

def clear(page,box,color=(1,1,1)):
    page.add_redact_annot(fitz.Rect(*box),fill=False)

p=doc[0]; gray=(.973,.973,.973)
clear(p,(29,99,170,112),gray)
clear(p,(29,123,175,150),gray)
clear(p,(370,98,567,161),gray)
clear(p,(440,193,567,219))
# Customizable body lines; remove the example-only Dekton surcharge.
for box in [(29,315,321,337),(29,338,320,349),(29,439,321,462),(29,462,321,485),(29,549,321,573)]:clear(p,box,gray)
for top,bottom,bg in [(268,280,gray),(623,648,(1,1,1)),(653,679,gray),(683,709,(1,1,1)),(713,739,gray)]:
    if top>300:clear(p,(29,top,322,bottom),bg)
    clear(p,(360,top,567,bottom),bg)

p=doc[1]
for top,bottom,bg in [(97,122,(1,1,1)),(127,152,gray),(157,182,(1,1,1)),(187,213,gray)]:
    clear(p,(29,top,322,bottom),bg);clear(p,(360,top,567,bottom),bg)
for top,bottom,bg in [(233,245,gray),(252,265,(1,1,1)),(272,285,(1,.4,0))]:clear(p,(440,top,568,bottom),bg)
for p in doc:
    clear(p,(30,807,180,825))
    p.apply_redactions(images=0,graphics=0)
doc.set_metadata({})
target=root/'public/templates/kitchenbox-template.pdf'
doc.save(target,garbage=4,deflate=True)
text=''.join(p.get_text() for p in doc)
for forbidden in ['Schweidel','GOLD-2026-562','4 908 861','90 920','350.000','www.innonest.hu']:
    assert forbidden not in text,forbidden
print(target)
