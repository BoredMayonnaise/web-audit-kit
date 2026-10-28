"""Actual Chromium/file:// acceptance harness. Requires Playwright + Pillow.
Run after npm run build. Generated PDFs still require visual inspection.
"""
from pathlib import Path
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright, expect
import base64, copy, json, os

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'verification'
OUT.mkdir(exist_ok=True)

def main():
    fixtures = OUT / 'browser-fixtures'
    fixtures.mkdir(exist_ok=True)
    image = Image.new('RGB', (2800, 1800), '#e4e9dc')
    draw = ImageDraw.Draw(image)
    draw.rectangle((100, 100, 2700, 1700), outline='#526b50', width=15)
    draw.text((180, 180), 'ORIGINAL TEST SCREENSHOT - fictional evidence', fill='#243a22')
    for extension, mode in [('png','PNG'),('jpg','JPEG'),('webp','WEBP')]:
        image.save(fixtures / f'landscape.{extension}', mode)
    portrait = Image.new('RGB',(600,1800),'#f5f0e4')
    ImageDraw.Draw(portrait).text((30,40),'PORTRAIT TEST',fill='#34482e')
    portrait.save(fixtures / 'portrait.png')
    logo=Image.new('RGBA',(500,200),(0,0,0,0))
    ImageDraw.Draw(logo).rectangle((20,20,480,180),fill='#526b50')
    logo.save(fixtures / 'logo.png')
    (fixtures/'malformed.json').write_text('{ broken JSON')
    (fixtures/'unsupported.json').write_text('{"schemaVersion":999}')
    report = []
    def passed(message):
        report.append(message)
        print('PASS:',message,flush=True)
    with sync_playwright() as p:
        launch = {'headless':True}
        executable=os.environ.get('AUDIT_CHROMIUM_EXECUTABLE')
        if executable: launch['executable_path']=executable
        browser=p.chromium.launch(**launch)
        context=browser.new_context(offline=True,accept_downloads=True,viewport={'width':1440,'height':1000})
        def accept_dialog(dialog): dialog.accept()
        context.on('dialog',accept_dialog)
        page=context.new_page()
        errors=[];requests=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        context.on('request',lambda request:requests.append(request.url) if request.url.startswith(('http:','https:')) else None)
        app_url=(ROOT/'dist/web-audit-kit.html').as_uri()
        page.goto(app_url)
        page.get_by_role('button',name='Explore the example',exact=True).click()
        expect(page.get_by_role('heading',name='Project details')).to_be_visible()
        page.screenshot(path=str(OUT/'browser-project-desktop.png'),full_page=True)
        passed('Packaged HTML opens from file:// with networking disabled')
        page.get_by_role('button',name='New project',exact=True).click()
        def fill(label,value): page.get_by_label(label,exact=True).fill(value)
        fill('Client / business name','Juniper Home — test project')
        fill('Website URL','https://juniper.example')
        fill('Report title','A clearer client journey')
        fill('Auditor / studio name','Test Studio')
        fill('Auditor contact details','hello@test-studio.example')
        fill('Executive summary','Five manually authored findings for an offline workflow check. This is fictional test content.')
        fill('Audit scope & limitations','Fictional test fixture; no live website was audited.')
        page.get_by_role('button',name='Branding',exact=True).click()
        page.get_by_label('Upload logo',exact=True).set_input_files(fixtures/'logo.png')
        expect(page.get_by_alt_text('Your uploaded logo')).to_be_visible()
        page.get_by_label('Choose accent color',exact=True).fill('#334b65')
        page.get_by_role('button',name='Findings',exact=True).click()
        for i in range(1,6):
            page.get_by_role('button',name='Add finding',exact=True).click()
            fill('Finding title',f'Finding {i}')
            fill('Affected page / URL',f'https://juniper.example/page-{i}')
            fill('Observation',f'Fictional observation {i}.')
            fill('Business / user impact',f'User impact {i}.')
            fill('Recommended fix',f'Practical fix {i}.')
            fill('How to verify the fix',f'Verification step {i}.')
            page.get_by_label('Priority',exact=True).select_option('High' if i<3 else 'Medium')
            page.get_by_label('Estimated effort',exact=True).select_option('Small')
            if i==1:
                page.get_by_label('Add screenshots',exact=True).set_input_files([fixtures/'landscape.png',fixtures/'landscape.jpg',fixtures/'landscape.webp'])
                expect(page.locator('.screenshot-card')).to_have_count(3)
                for j in range(1,4):fill(f'Screenshot {j} caption',f'Original fictional screenshot {j}')
            if i==5:
                page.get_by_label('Add screenshots',exact=True).set_input_files(fixtures/'portrait.png')
                expect(page.locator('.screenshot-card')).to_have_count(1)
                fill('Screenshot 1 caption','Original portrait screenshot for pagination testing')
        page.get_by_role('button',name='Move finding 5 up',exact=True).click()
        page.get_by_role('button',name='Duplicate finding',exact=True).click()
        expect(page.locator('.finding-list>li')).to_have_count(6)
        page.get_by_role('button',name='Delete finding',exact=True).click()
        expect(page.locator('.finding-list>li')).to_have_count(5)
        page.get_by_role('button',name='Action Plan',exact=True).click()
        for checkbox in page.locator('.finding-checkbox input').all(): checkbox.check()
        page.get_by_role('button',name='Move action 5 up',exact=True).click()
        expect(page.locator('.action-list>li')).to_have_count(5)
        def save(name):
            with page.expect_download() as event: page.get_by_role('button',name='Save project',exact=True).click()
            path=fixtures/name;event.value.save_as(path)
            expect(page.locator('.save-state')).to_have_text('No unsaved changes')
            return json.loads(path.read_text()),path
        saved,saved_path=save('roundtrip.audit.json')
        assert saved['schemaVersion']==1 and len(saved['findings'])==5
        assert [f['title'] for f in saved['findings']]==['Finding 1','Finding 2','Finding 3','Finding 5','Finding 4']
        assert len(saved['actionPlan'])==5 and saved['branding']['logo']['dataUrl'].startswith('data:image/png;base64,')
        assert max(s['width'] for f in saved['findings'] for s in f['screenshots'])<=2048
        passed('Creates five findings, processes PNG/JPEG/WebP and a logo, duplicates/deletes, and reorders findings/actions')
        page.close()
        page=context.new_page()
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(app_url)
        page.get_by_label('Open project file',exact=True).set_input_files(saved_path)
        expect(page.locator('.notice')).to_contain_text('Opened roundtrip.audit.json')
        reopened,_=save('reopened.audit.json')
        assert reopened==saved
        assert page.locator('.report-document img').evaluate_all('(images) => images.every(image => image.complete && image.naturalWidth > 0)')
        passed('Save, close tab, reopen JSON: exact field/order/image equality; restored images decode')
        for path in ['malformed.json','unsupported.json']:
            page.get_by_label('Open project file',exact=True).set_input_files(fixtures/path)
            expect(page.get_by_role('alert')).to_contain_text('unchanged')
            unchanged,_=save('unchanged.audit.json')
            assert unchanged==saved
        passed('Malformed JSON and unsupported schema cannot overwrite current project')
        page.get_by_role('button',name='Project',exact=True).click()
        fill('Client / business name','Unsaved changes to preserve')
        def reject(dialog):dialog.dismiss()
        context.remove_listener('dialog',accept_dialog)
        page.once('dialog',reject)
        with page.expect_event('dialog'):
            page.get_by_label('Open project file',exact=True).set_input_files(saved_path)
        expect(page.locator('.sidebar-project strong')).to_have_text('Unsaved changes to preserve')
        context.on('dialog',accept_dialog)
        passed('Unsaved replacement confirmation can cancel without changing work')
        page.get_by_label('Open project file',exact=True).set_input_files(saved_path)
        expect(page.locator('.notice')).to_contain_text('Opened roundtrip.audit.json')
        page.get_by_role('button',name='Preview',exact=True).click()
        page.evaluate('window.print = () => { window.auditPrintCalls = (window.auditPrintCalls || 0) + 1; }')
        page.get_by_role('button',name='Export PDF',exact=True).first.click()
        page.wait_for_function('window.auditPrintCalls === 1')
        passed('Export PDF invokes window.print after preparing the report')
        for count in [0,1,20]:
            candidate=copy.deepcopy(saved)
            candidate['findings']=[]
            for i in range(count):
                f=copy.deepcopy(saved['findings'][i%5]);f['id']=f'test-finding-{i+1}';f['title']=f'Finding {i+1}: an actionable observation'
                if i==0:
                    f['observation']='Long-text test: describe the evidence clearly and preserve every sentence. '*145
                    f['screenshots']=[copy.deepcopy(saved['findings'][3]['screenshots'][0])]
                    f['screenshots'][0]['id']=f'portrait-{i}'
                else:f['screenshots']=[]
                candidate['findings'].append(f)
            candidate['actionPlan']=[f['id'] for f in candidate['findings']]
            path=fixtures/f'{count}-findings.audit.json';path.write_text(json.dumps(candidate))
            page.get_by_label('Open project file',exact=True).set_input_files(path)
            expect(page.locator('.notice')).to_contain_text(f'Opened {count}-findings.audit.json')
            page.get_by_role('button',name='Preview',exact=True).click()
            for paper in ['A4','Letter']:
                page.get_by_label('Paper size',exact=True).select_option(paper)
                page.emulate_media(media='print')
                assert page.locator('.app-header').is_hidden() and page.locator('.sidebar').is_hidden()
                page.pdf(path=str(OUT/f'browser-{count}-findings-{paper}.pdf'),format=paper,prefer_css_page_size=True,print_background=True,display_header_footer=False)
                page.emulate_media(media='screen')
            passed(f'{count} findings: print controls hidden; A4 and Letter PDFs generated (visual inspection still required)')
        page.get_by_role('button',name='Project',exact=True).click()
        for width in [1440,1024,768,390,320]:
            page.set_viewport_size({'width':width,'height':1000})
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'),f'Horizontal overflow at {width}'
            page.screenshot(path=str(OUT/f'browser-project-{width}.png'),full_page=True)
        passed('No project-screen horizontal overflow at 1440, 1024, 768, 390, and 320 px')
        assert not requests, requests
        assert not errors, errors
        passed(f'No HTTP(S) requests or JavaScript page errors; Chromium {browser.version}')
        (OUT/'browser-results.json').write_text(json.dumps({'browser':browser.version,'checks':report,'pdf_visual_inspection':'pending'},indent=2))
        context.close();browser.close()

if __name__=='__main__':main()
