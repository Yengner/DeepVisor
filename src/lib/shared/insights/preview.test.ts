import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {previewPresentation,previewScenarios} from './preview';
it.each(previewScenarios)('builds an isolated %s visual fixture',id=>{
 const p=previewPresentation(id);expect(p.payload.account).toContain('[PREVIEW]');expect(p.id).toMatch(/^preview-/);expect(p.payload.limitations.join(' ')).toContain('synthetic');
 if(p.payload.recap?.cpr!==null&&p.payload.recap)expect(p.payload.recap.cpr).toBe(p.payload.recap.spend!/p.payload.recap.results!);
 for(const c of p.payload.lifecycle)for(const media of c.brief.media)expect(media.image).toMatch(/^data:image\/svg\+xml,/);
});
it('gates the preview on the server and uses the production content renderer',()=>{
 const page=readFileSync('src/app/(root)/insights/preview/page.tsx','utf8');expect(page).toContain("process.env.NODE_ENV!=='development'");expect(page).toContain('await getRequiredAppContext()');
 const client=readFileSync('src/components/insights/InsightsPreview.tsx','utf8');expect(client).toContain('<InsightContent');expect(client).not.toMatch(/fetch\(|supabase|\/api\//);
});
it('shows missing observations separately from genuine zeros',()=>{const sparse=previewPresentation('sparse').payload.recap!,zero=previewPresentation('zero').payload.recap!;expect(sparse.days.some(d=>d.spend===null)).toBe(true);expect(sparse.results).toBeNull();expect(zero.results).toBe(0);expect(zero.cpr).toBeNull();});
