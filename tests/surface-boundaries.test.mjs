import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSurfaceBoundaryCoordinates as build} from '../cad-viewer/surface-boundaries.js';
const fixture=(split=false,color=false)=>({
  attributes:{position:{array:[0,0,0,1,0,0,0,1,0,1,1,0]},normal:{array:[0,0,1,0,0,1,0,0,1,0,0,1]}},
  index:{array:[0,1,2,1,3,2]},
  brep_faces:split?[{first:0,last:0,color:[1,1,1]},{first:1,last:1,color:color?[1,0,0]:[1,1,1]}]:[{first:0,last:1}],
});
const count=coordinates=>{
  let n=0;
  for(let triangle=0;triangle<coordinates.length/9;triangle++)for(let edge=0;edge<3;edge++)
    if(coordinates[triangle*9+((edge+1)%3)*3+edge]===0)n++;
  return n;
};
test('CAD boundaries exclude triangulation and tangent seams but retain material transitions',()=>{
  assert.equal(count(build(fixture())),4);
  assert.equal(count(build(fixture(true))),4);
  assert.equal(count(build(fixture(true,true))),6);
});
test('duplicate CAD vertices weld without blending sharp face normals',()=>{
  const mesh=fixture(true);
  mesh.attributes.position.array=[0,0,0,1,0,0,0,1,0,1,0,0,1,1,0,0,1,0];
  mesh.attributes.normal.array=[0,0,1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0];
  mesh.index.array=[0,1,2,3,4,5];
  assert.equal(count(build(mesh)),6);
  mesh.attributes.normal.array.fill(0);
  for(let i=2;i<18;i+=3)mesh.attributes.normal.array[i]=1;
  assert.equal(count(build(mesh)),4);
  mesh.brep_faces=[];assert.equal(count(build(mesh)),0);
});
