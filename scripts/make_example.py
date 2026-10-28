"""Regenerate original fictional mockups. Optional: Python 3 + Pillow."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import io, base64, json
root=Path(__file__).resolve().parents[1]
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
bold='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def text(draw,xy,value,size=18,fill='#233d35',heavy=False):
    draw.text(xy,value,font=ImageFont.truetype(bold if heavy else font,size),fill=fill)
def mockup(index):
    im=Image.new('RGB',(1000,650),'#f8f7f2'); d=ImageDraw.Draw(im)
    d.rectangle((0,0,1000,36),fill='#e9eee5');text(d,(26,9),'FICTIONAL DEMONSTRATION  /  Original illustrative mockup',13)
    d.rectangle((0,36,1000,88),fill='#fff');d.rounded_rectangle((110,49,890,75),9,fill='#f0f1ee')
    text(d,(132,54),'https://brightside-cleaning.example',13,fill='#6e786f')
    for x in (28,48,68):d.ellipse((x,57,x+8,65),fill='#d3d9d2')
    text(d,(44,117),'brightside',26,heavy=True);text(d,(45,150),'A little cleaner. A little brighter.',12)
    for x,t in [(480,'Home'),(580,'Services'),(710,'About'),(815,'Contact')]:text(d,(x,131),t,15)
    d.line((0,187,1000,187),fill='#dde2d7')
    if index in [0,1,2]:
        text(d,(45,237),'More living.',38,heavy=True);text(d,(45,286),'Less cleaning.',38,heavy=True)
        text(d,(47,355),'Thoughtful home cleaning for busy people.',17)
        text(d,(47,387),'Find your fresh start with Brightside.',17)
        d.rounded_rectangle((46,442,262,496),6,fill='#486350');text(d,(71,458),'Get a free quote',18,fill='white',heavy=True)
        d.rounded_rectangle((510,220,957,520),14,fill='#dce4d6')
        d.rectangle((570,370,899,472),fill='#b8c8ad');d.rounded_rectangle((550,380,919,450),15,fill='#94a88a')
        d.rectangle((596,312,878,406),fill='#9bb18f');d.line((737,316,737,395),fill='#e1e9db',width=3)
        d.rectangle((827,282,836,361),fill='#8c795b');d.ellipse((796,232,864,305),fill='#66885d')
        d.ellipse((570,499,901,541),fill='#c1ceba')
        if index==0:
            d.rectangle((830,88,1000,650),fill='#f2e5df');d.line((830,88,830,650),fill='#bd674d',width=3)
            text(d,(850,280),'Outside',18,fill='#8b4933',heavy=True);text(d,(850,311),'mobile',18,fill='#8b4933');text(d,(850,342),'viewport',18,fill='#8b4933')
            d.rounded_rectangle((31,430,282,509),9,outline='#bd674d',width=3)
        if index==1:
            d.rounded_rectangle((523,231,944,509),8,outline='#bd674d',width=3)
            d.rectangle((535,468,931,504),fill='#f8ece3');text(d,(548,477),'Illustration: oversized hero asset',17,fill='#8b4933')
        if index==2:
            d.rounded_rectangle((565,116,679,163),6,outline='#bd674d',width=3)
            d.rectangle((480,549,957,611),fill='#e9eee5');text(d,(500,563),'Services menu opens on hover only',16)
    elif index==3:
        text(d,(210,219),'Your fresh start begins here.',30,heavy=True)
        for y,label in [(290,'Full name'),(371,'Email address'),(452,'Tell us about your home')]:
            d.rounded_rectangle((210,y,790,y+58),5,fill='white',outline='#d7ddd2');text(d,(230,y+19),label,16,fill='#7f897c')
        d.rounded_rectangle((210,549,790,606),6,fill='#486350');text(d,(413,567),'Request a quote',18,fill='white')
        d.rounded_rectangle((197,276,803,522),8,outline='#bd674d',width=3)
    else:
        text(d,(45,228),'Page title preview',17,fill='#737e70')
        d.rounded_rectangle((45,274,955,467),10,fill='white',outline='#d7ddd2')
        text(d,(75,302),'brightside-cleaning.example',17,fill='#526b50');text(d,(75,348),'Home',28,fill='#334c84')
        text(d,(75,400),'A generic page title gives little context about the service.',18)
        d.rounded_rectangle((64,336,189,390),6,outline='#bd674d',width=3)
        text(d,(46,523),'Illustrative search snippet. Not a real search result.',17,fill='#737e70')
    text(d,(45,620),'Fictional interface and observation. No live website was tested.',13,fill='#737e70')
    out=io.BytesIO();im.save(out,format='PNG',optimize=True)
    return {'id':f'demo-image-{index+1}','dataUrl':'data:image/png;base64,'+base64.b64encode(out.getvalue()).decode(),'width':1000,'height':650,'caption':[
        'Fictional mockup: primary content extends beyond a narrow viewport.',
        'Fictional mockup: the hero image represents an asset to optimize; no loading speed was measured.',
        'Fictional mockup: a hover-only Services menu provides no keyboard interaction.',
        'Fictional mockup: the quote form uses disappearing placeholders in place of visible labels.',
        'Fictional mockup: a generic page title does not describe the cleaning service.'
    ][index]}
findings=[
('Quote button is hard to reach on mobile','Mobile usability','https://brightside-cleaning.example/',
 'In this fictional narrow-screen layout, the hero has a fixed minimum width. Content extends beyond the viewport and visitors must scroll sideways to reach part of the quote button.',
 'People using a phone may miss the next step or struggle to request a quote.',
 'Replace the fixed hero width with a flexible single-column layout on small screens. Keep the quote button inside the viewport with a comfortable touch target.',
 'High','Medium','At 320, 375, and 390 CSS pixels wide, confirm there is no horizontal scrolling. Complete the quote journey on a phone and with keyboard controls.'),
('Quote form needs persistent labels','Forms','https://brightside-cleaning.example/quote',
 'The fictional quote form identifies fields only with placeholder text. The field name disappears after typing, and there is no visible explanation of required fields or input errors.',
 'Visitors may lose track of what a field asks for. Assistive technology users may lack a reliable accessible field name.',
 'Add visible labels associated with each input, indicate required fields in text, and place specific error messages next to the relevant field.',
 'High','Small','Tab through the form and inspect accessible names. Submit empty and invalid values, then confirm each error explains how to correct it without losing entered data.'),
('Hero image should be resized for delivery','Performance','https://brightside-cleaning.example/',
 'The demonstration design uses one large hero asset for every screen size. This is an illustrative implementation issue, not a measured performance result; no real loading times were collected.',
 'An unnecessarily large image can delay useful content and use more mobile data.',
 'Export appropriately sized image variants, use responsive srcset and sizes, and choose a modern compressed format with a suitable fallback. Reserve the image dimensions in the layout.',
 'Medium','Medium','Inspect the delivered image at mobile and desktop widths. Compare transferred bytes and loading behavior before and after using the same test conditions, and check visual quality.'),
('Services menu relies on a mouse hover','Navigation','https://brightside-cleaning.example/services',
 'In the fictional navigation, the Services submenu appears only on hover. Its trigger cannot be opened using a keyboard or a touch gesture.',
 'Keyboard and touch users may be unable to discover service pages.',
 'Use a real button to toggle the submenu. Expose its expanded state, support Enter, Space, and Escape, and keep submenu links in a logical focus order.',
 'Medium','Medium','Navigate without a mouse. Open and close the menu with Enter, Space, and Escape, follow a submenu link, and confirm the same controls work by touch.'),
('Homepage title lacks useful context','Basic SEO','https://brightside-cleaning.example/',
 'The fictional homepage document title is “Home”. It does not identify Brightside or describe the cleaning service. The screenshot is an illustrative snippet, not a real search result.',
 'Visitors scanning browser tabs or search listings have less context about the page. No ranking or traffic change is claimed.',
 'Write a unique, descriptive title such as “Home Cleaning Services | Brightside Cleaning”. Check the visible heading and description for clear, consistent service information.',
 'Low','Small','Inspect the rendered document title and browser tab. Confirm the title is unique across the reviewed pages and accurately reflects the page content.')]
project={'schemaVersion':1,'id':'demo-brightside','demo':True,'details':{
'client':'Brightside Cleaning','website':'https://brightside-cleaning.example','title':'A clearer path to a cleaner home','date':'2026-10-28','auditor':'Alex Morgan · Studio North','contact':'alex@studionorth.example\nstudionorth.example',
'scope':'Fictional manual review of the homepage, services navigation, and quote form across desktop and narrow-screen layouts. Covers mobile usability, performance considerations, navigation, forms, and basic on-page SEO.\n\nLimitations: this is editable demonstration content. No live website, assistive technology session, performance measurement, analytics, security, or comprehensive accessibility audit was performed.',
'summary':'Brightside’s friendly identity and clear service offering provide a strong starting point. This fictional review highlights five opportunities to make the path from first visit to quote request easier to follow.\n\nStart with the mobile quote button and the form’s missing labels, which affect the primary customer journey. Then improve image delivery and keyboard access to the Services menu. A more descriptive homepage title is a small final refinement. Each recommendation includes a practical way to verify the change.\n\nAll business details, observations, and screenshots are fictional examples, not findings from a live website.'},'branding':{'accent':'#526b50','logo':None},'findings':[],'actionPlan':['demo-finding-1','demo-finding-2','demo-finding-3','demo-finding-4','demo-finding-5'],'paperSize':'A4'}
for i,(title,category,page,observation,impact,recommendation,priority,effort,verification) in enumerate(findings):
    project['findings'].append(dict(id=f'demo-finding-{i+1}',title=title,category=category,page=page,observation=observation,impact=impact,recommendation=recommendation,priority=priority,effort=effort,verification=verification,screenshots=[mockup(i if i not in [1,2,3] else {1:3,2:1,3:2}[i])]))
(root/'examples/brightside-cleaning.audit.json').write_text(json.dumps(project,indent=2)+'\n')
