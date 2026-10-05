import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { Plot, LayerResult, Health } from "../src/lib/contracts/index.ts";
import { getCountry } from "../src/server/countries/index.ts";
import { layerCatalog, runLayer } from "../src/server/core/layers.ts";
import { municipalityAt } from "../src/server/countries/it/municipality.ts";
import { cache, canonicalKey } from "../src/server/core/cache.ts";
import { NotFound } from "../src/server/core/errors.ts";
import { tile, PngTile, TileParams } from "../src/server/countries/it/tiles.ts";
import { GET as health } from "../src/app/api/v1/health/route.ts";
import { GET as at } from "../src/app/api/v1/plots/at/route.ts";
import { GET as byId } from "../src/app/api/v1/plots/[id]/route.ts";

const results: { check: string; state: "PASS" | "FAIL" | "PARTIAL"; detail: unknown }[] = [];
async function check(name: string, action: () => Promise<unknown>) {
  try { const detail = await action();results.push({check:name,state:"PASS",detail});console.log(`PASS ${name}`,JSON.stringify(detail));return detail; }
  catch (error) { const detail=error instanceof Error?error.message:"Unknown error";results.push({check:name,state:"FAIL",detail});console.log(`FAIL ${name}: ${detail}`);return undefined; }
}
const it=getCountry("it");
await check("health",async()=>Health.parse(await (await health()).json()));
await check("geocode Milano Duomo",async()=>{const rows=await it.geocode("Piazza Duomo Milano");if(!rows.length)throw new Error("No geocoding results");return rows[0];});
let rural: z.infer<typeof Plot> | undefined;
await check("plotAt Milano Duomo is street",async()=>{
  try {await it.plotAt(45.4642,9.19);}catch(error){if(error instanceof NotFound&&error.message.includes("strada"))return {expected:"not_found",message:error.message};throw error;}
  throw new Error("Street incorrectly returned as plot");
});
await check("plotAt rural Toscana",async()=>{
  const response=await at(new Request("http://localhost/api/v1/plots/at?lat=43.7&lon=11.32"));
  if(response.status!==200)throw new Error(JSON.stringify(await response.json()));
  rural=Plot.parse(await response.json());
  if(rural.id!=="it:A564:_:60:110")throw new Error(`Unexpected parcel ${rural.id}`);
  return {id:rural.id,areaM2:rural.areaM2,istatCode:rural.municipality?.istatCode};
});
if(rural){
  await check("plotById cold rural",async()=>{
    await cache.set(canonicalKey("plot:v1",rural!.id),null,0);
    const response=await byId(new Request(`http://localhost/api/v1/plots/${rural!.id}`),{params:Promise.resolve({id:rural!.id})});
    if(response.status!==200)throw new Error(JSON.stringify(await response.json()));
    const plot=Plot.parse(await response.json());if(plot.id!==rural!.id)throw new Error("ID roundtrip mismatch");return {id:plot.id};
  });
}
for(const [name,p,belfiore] of [["Milano",{lat:45.4642,lon:9.19},"F205"],["Toscana",{lat:43.7,lon:11.32},"A564"]] as const){
  const municipality=await check(`municipality ${name}`,async()=>(await municipalityAt(p,belfiore)).municipality);
  const plot=name==="Toscana"&&rural?rural:Plot.parse({id:`live:${name}:point`,country:"it",cadastral:{municipalityCode:belfiore,section:null,sheet:"0",parcel:"0",label:"Smoke test puntuale: non è un lotto catastale"},municipality:municipality??null,address:null,centroid:p,geometry:null,areaM2:null,perimeterM:null,provenance:[]});
  await Promise.all(layerCatalog.map(async({id})=>{
    const result=LayerResult.parse(await runLayer(id,plot,it.layers[id],30_000));
    const state=result.status==="unavailable"||result.status==="error"?"FAIL":result.status==="partial"?"PARTIAL":"PASS";
    const detail={status:result.status,scope:result.scope,headline:result.headline,metrics:result.metrics,sourceIds:result.provenance.map(p=>p.sourceId),notes:result.notes};
    results.push({check:`${id} ${name}`,state,detail});console.log(`${state} ${id} ${name}: ${result.status}`);
  }));
}
const zoom=16,p={lat:43.7,lon:11.32},n=2**zoom;
const x=Math.floor((p.lon+180)/360*n),y=Math.floor((1-Math.asinh(Math.tan(p.lat*Math.PI/180))/Math.PI)/2*n);
for(const overlay of ["cadastre","flood","landslide"]){await check(`tile ${overlay}`,async()=>{const bytes=await tile(TileParams.parse({overlay,z:String(zoom),x:String(x),y:String(y)}));PngTile.parse(bytes);return {z:zoom,x,y,bytes:bytes.length};});}
const summary={executedAt:new Date().toISOString(),points:{milano:{lat:45.4642,lon:9.19},toscana:{lat:43.7,lon:11.32}},results};
await writeFile(new URL("../tests/live-results.json",import.meta.url),`${JSON.stringify(summary,null,2)}\n`);
const failed=results.filter(r=>r.state==="FAIL").length;
console.log(`Live summary: ${results.filter(r=>r.state==="PASS").length} PASS, ${results.filter(r=>r.state==="PARTIAL").length} PARTIAL, ${failed} FAIL.`);
process.exitCode=failed?1:0;
