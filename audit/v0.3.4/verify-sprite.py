"""Re-crop printed Plan faces into a separate sprite; compare the release bytes."""
from pathlib import Path
from tempfile import TemporaryDirectory
import hashlib, subprocess
from PIL import Image
root=Path(__file__).resolve().parents[2]
with TemporaryDirectory(prefix='kutna-sprite-') as temp:
    temp=Path(temp)
    sprite=Image.new('RGB',(1290,3010))
    for page,first,count in [(5,0,9),(7,9,6)]:
        prefix=temp/f'page-{page}'
        subprocess.run(['pdftoppm','-f',str(page),'-l',str(page),'-r','176','-singlefile','-png',str(root/'mincmistr/Mincmistr_Print_and_Play.pdf'),str(prefix)],check=True)
        sheet=Image.open(prefix.with_suffix('.png'))
        for i in range(count):
            row,col=divmod(i,3);x,y=88+col*440,44+row*616
            sprite.paste(sheet.crop((x+5,y+7,x+435,y+609)),(col*430,((first+i)//3)*602))
    output=temp/'plans.webp';sprite.save(output,lossless=True,method=6)
    rebuilt=output.read_bytes();shipped=(root/'src/assets/mincmistr-plans.webp').read_bytes()
    assert rebuilt==shipped,'Sprite bytes differ (also check renderer/encoder versions).'
    print('Byte-identical Plan sprite:',hashlib.sha256(rebuilt).hexdigest())
