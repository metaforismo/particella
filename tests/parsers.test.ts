import { test } from "node:test";
import assert from "node:assert/strict";
import type { PlotGeometry } from "../src/server/geo/index.ts";
import { coversPoint, measurements, tileBbox, spatialRelation, representativePoint } from "../src/server/geo/index.ts";
import { estimateSlope } from "../src/server/geo/terrain.ts";
import { gmlGeometry, xmlDocument, wfsMembers } from "../src/server/geo/gml.ts";
import { parseParcels, parseZoning, parsePlotId } from "../src/server/countries/it/cadastre.ts";
import { parseNominatim, parsePhoton } from "../src/server/countries/it/geocode.ts";
import { parsePga } from "../src/server/countries/it/layers/seismic.ts";
import { parseTinitaly } from "../src/server/countries/it/layers/terrain.ts";
import { parseSolar } from "../src/server/countries/it/layers/solar.ts";
import { parseServices, serviceCategory } from "../src/server/countries/it/layers/services.ts";
import { landslideClass, severityForHazard } from "../src/server/countries/it/layers/hazards.ts";
import { parseArc, parseGeo } from "../src/server/countries/it/queries.ts";
import { UpstreamError } from "../src/server/core/errors.ts";
import { parseDpcCsv, parsePopulationCsv } from "../scripts/snapshots/parsers.ts";
import { fixtureJson,fixtureText,payload } from "./helpers.ts";

const square:PlotGeometry={type:"Polygon",coordinates:[[[0,0],[0.001,0],[0.001,0.001],[0,0.001],[0,0]]]};
test("real AdE GML swaps EPSG:6706 axes and chooses containing parcel, not first/nearest",()=>{
  const parcels=parseParcels(fixtureText("ade-rural.xml"));assert.equal(parcels.length,2);
  assert.equal(coversPoint(parcels[0].geometry,{lat:43.7,lon:11.32}),false);
  assert.equal(coversPoint(parcels[1].geometry,{lat:43.7,lon:11.32}),true);assert.equal(parcels[1].parcel,"110");
  assert.ok(parcels[1].geometry.coordinates.flat(3).every(Number.isFinite));
  const stats=measurements(parcels[1].geometry);assert.ok(stats.areaM2>5000&&stats.areaM2<20000);assert.ok(stats.perimeterM>300);
  assert.equal(parseParcels(fixtureText("ade-street.xml"))[0].special,true);
  const zoning=parseZoning(fixtureText("ade-zoning-rural.xml"))[0];assert.equal(zoning.sheet,"60");assert.equal(zoning.reference,"A564_006000");
  assert.deepEqual(parsePlotId("it:A564:_:60:110"),{municipalityCode:"A564",section:null,sheet:"60",parcel:"110"});
  assert.throws(()=>parsePlotId("it:bad:_:60:110"));
});
test("covers includes boundary and excludes holes; representative point is inside",()=>{
  const withHole:PlotGeometry={type:"Polygon",coordinates:[...square.coordinates,[[0.0002,0.0002],[0.0008,0.0002],[0.0008,0.0008],[0.0002,0.0008],[0.0002,0.0002]]]};
  assert.equal(coversPoint(square,{lat:0,lon:0.0005}),true);assert.equal(coversPoint(withHole,{lat:0.0005,lon:0.0005}),false);
  assert.equal(coversPoint(withHole,{lat:0.0002,lon:0.0005}),true);assert.ok(coversPoint(withHole,representativePoint(withHole)));
  const multi:PlotGeometry={type:"MultiPolygon",coordinates:[square.coordinates,[[[1,1],[1.001,1],[1.001,1.001],[1,1.001],[1,1]]]]};assert.equal(coversPoint(multi,{lat:1.0005,lon:1.0005}),true);
});
test("GML supports holes/multipolygons and rejects truncation, unknown CRS and OGC exception",()=>{
  const polygon={Polygon:{"@_srsName":"urn:ogc:def:crs:EPSG::6706",exterior:{LinearRing:{posList:{"#text":"0 0 0 1 1 1 1 0 0 0","@_srsDimension":"2"}}},interior:{LinearRing:{posList:"0.2 0.2 0.2 0.8 0.8 0.8 0.8 0.2 0.2 0.2"}}}};
  const geometry=gmlGeometry({MultiSurface:{surfaceMember:[polygon,polygon]}});assert.equal(geometry.type,"MultiPolygon");assert.equal(geometry.coordinates[0].length,2);
  assert.throws(()=>wfsMembers('<wfs:FeatureCollection xmlns:wfs="wfs" numberMatched="2" numberReturned="0"/>'),UpstreamError);
  assert.throws(()=>xmlDocument('<ows:ExceptionReport xmlns:ows="ows"><ows:Exception>Service disabled</ows:Exception></ows:ExceptionReport>'),UpstreamError);
  assert.throws(()=>gmlGeometry({Polygon:{...polygon.Polygon,"@_srsName":"EPSG:3857"}}),UpstreamError);
});
test("real geocoders normalize bbox to west/south/east/north",()=>{
  const osm=parseNominatim(fixtureJson("nominatim.json"))[0];assert.ok(osm.center.lat>45&&osm.center.lon<10);assert.ok(osm.bbox![0]<10&&osm.bbox![1]>45);
  const photon=parsePhoton(fixtureJson("photon.json"))[0];assert.ok(photon.center.lat>45&&photon.center.lon<10);
  assert.throws(()=>parseNominatim({error:"invalid"}),UpstreamError);
});
test("real INGV nodes use distance selection; DPC retains leading zeroes and regional subclasses",()=>{
  const nodes=parsePga(fixtureText("pga-firenze.xml"));assert.equal(nodes.length,2);assert.equal(nodes[1].pga,0.1302);assert.equal(nodes[1].center.lat,43.76395);
  const zones=parseDpcCsv('\ufeffCOD_ISTAT_COMUNE;ZONA_SISMICA\n15146;3\n56039;3A-3B\n');assert.equal(zones["015146"],"3");assert.equal(zones["056039"],"3A-3B");
  const population=parsePopulationCsv('Codice comune;Comune;Età;Totale maschi;Totale femmine;Totale\n015146;Milano;0;1;1;2\n015146;Milano;999;663800;699063;1362863\n');assert.equal(population["015146"],1362863);
});
test("real terrain/PVGIS/grid parse and no-data differs from valid zero",()=>{
  assert.equal(parseTinitaly(fixtureJson("terrain.json")),119.29900360107422);
  assert.equal(parseTinitaly({features:[{properties:{GRAY_INDEX:0}}]}),0);assert.equal(parseTinitaly({features:[{properties:{GRAY_INDEX:-9999}}]}),null);
  assert.equal(parseSolar(fixtureJson("solar.json")).outputs.totals.fixed.E_y,1123.93);
  assert.equal(parseArc(payload("grid-rural.json")).features[0].attributes.TOT_P_2021,99);
  assert.equal(parseGeo(payload("flood-empty.json")).features.length,0);assert.equal(parseGeo(payload("flood-positive.json")).features.length,1);
  assert.throws(()=>parseArc({...payload("grid-rural.json"),bytes:new TextEncoder().encode('{"error":{"code":400}}')}),UpstreamError);
});
test("OSM categories, straight-line distance, partial Overpass errors",()=>{
  assert.equal(serviceCategory({amenity:"pharmacy"}),"health");assert.equal(serviceCategory({shop:"clothes"}),null);
  const data=parseServices(fixtureJson("services.json"),{lat:45.4642,lon:9.19});assert.ok(data.features.length>0);assert.ok(data.features.every(f=>f.properties.exactDistanceM<=1000));
  assert.throws(()=>parseServices({osm3s:{timestamp_osm_base:"2026-10-05"},elements:[],remark:"runtime error"},{lat:0,lon:0}),UpstreamError);
});
test("risk classifications stay stable; AA and empty are not safe",()=>{
  assert.equal(landslideClass({pericolosita:"Elevata P3"}),"P3");assert.equal(landslideClass({classe:"AA"}),"AA");assert.equal(severityForHazard(["AA"]),"unknown");assert.equal(severityForHazard([]),"unknown");assert.equal(severityForHazard(["P1","P2"]),"medium");
});
test("protected sites distinguish contains/intersects/nearby",()=>{
  const smaller:PlotGeometry={type:"Polygon",coordinates:[[[0.0001,0.0001],[0.0009,0.0001],[0.0009,0.0009],[0.0001,0.0009],[0.0001,0.0001]]]};
  assert.equal(spatialRelation(square,smaller,{lat:0.0005,lon:0.0005}).relation,"contains");
  assert.equal(spatialRelation(square,null,{lat:0.0005,lon:0.002}).relation,"nearby");assert.ok(spatialRelation(square,null,{lat:0.0005,lon:0.002}).distanceM>100);
});
test("terrain slope known plane and Mercator tile axes",()=>{
  const d=180/Math.PI/6371008.8;
  const slope=estimateSlope([{center:{lat:0,lon:0},elevation:0},{center:{lat:0,lon:100*d},elevation:10},{center:{lat:100*d,lon:0},elevation:0},{center:{lat:100*d,lon:100*d},elevation:10}]);assert.ok(Math.abs(slope!-10)<1e-6);
  assert.equal(estimateSlope([{center:{lat:0,lon:0},elevation:1}]),null);
  const [w,s,e,n]=tileBbox(1,1,0);assert.equal(w,0);assert.equal(s,0);assert.ok(e>20000000&&n>20000000);
});
