// Display-only correction. Require repeated profiles on a long axis-aligned
// fillet; reject planar and weakly supported faces. Never move points.
export function repairExtrusionNormals(mesh) {
  const p=mesh.attributes?.position?.array,n=mesh.attributes?.normal?.array;
  if(!p || !n || p.length!==n.length)return n;
  const output=Float32Array.from(n);
  for(const face of mesh.brep_faces || []) {
    const ids=[...new Set(mesh.index.array.slice(face.first*3,(face.last+1)*3))];
    if(ids.length<30)continue;
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    for(const id of ids)for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],p[id*3+j]);hi[j]=Math.max(hi[j],p[id*3+j]);}
    const size=hi.map((x,j)=>x-lo[j]),axis=size.indexOf(Math.max(...size));
    const [u,v]=[0,1,2].filter(j=>j!==axis).sort((a,b)=>size[b]-size[a]);
    if(size[axis]<4*size[u] || size[v]<1e-6)continue;
    const tol=size[axis]*1e-8,groups=new Map();let invalid=false;
    for(const id of ids){
      if(Math.abs(n[id*3+axis])/Math.hypot(...n.slice(id*3,id*3+3))>.15){invalid=true;break;}
      const key=[u,v].map(j=>Math.round((p[id*3+j]-lo[j])/tol)).join(',');
      if(!groups.has(key))groups.set(key,{x:p[id*3+u],y:p[id*3+v],ids:[],lo:Infinity,hi:-Infinity});
      const g=groups.get(key);g.ids.push(id);g.lo=Math.min(g.lo,p[id*3+axis]);g.hi=Math.max(g.hi,p[id*3+axis]);
    }
    if(invalid)continue;
    const profile=[...groups.values()].sort((a,b)=>a.x-b.x);
    if(profile.filter(g=>g.hi-g.lo>size[axis]*.8).length<8)continue;
    const proposed=[];
    for(let i=0;i<profile.length;i++){
      // The normal of an extrusion is perpendicular to its straight axis.
      // Share the transverse normal only at matching profile coordinates.
      const nn=[0,0,0];
      for(const id of profile[i].ids){nn[u]+=n[id*3+u];nn[v]+=n[id*3+v];}
      const len=Math.hypot(...nn);for(let j=0;j<3;j++)nn[j]/=len;
      const projected=nn.slice();
      // Recover the transverse tangent from positions, rather than retaining
      // triangulation-dependent transverse errors in the imported normals.
      const current=profile[i],tx=-nn[v],ty=nn[u];
      const bandwidth=Math.hypot(size[u],size[v])*.06;
      const system=Array.from({length:3},()=>[0,0,0,0]);let samples=0;
      for(const other of (profile.length<=2048 ? profile : [])){
        const dx=other.x-current.x,dy=other.y-current.y,d=Math.hypot(dx,dy),along=dx*tx+dy*ty;
        if(d>bandwidth)continue;
        const x=along/bandwidth,y=(dx*nn[u]+dy*nn[v])/bandwidth;
        const row=[1,x,x*x],weight=Math.pow(1-d*d/(bandwidth*bandwidth),2);
        for(let a=0;a<3;a++){for(let b=0;b<3;b++)system[a][b]+=weight*row[a]*row[b];system[a][3]+=weight*row[a]*y;}
        samples++;
      }
      // A weighted local curve fit avoids the nearest-neighbour changes that
      // left isolated dents, including near the ends of the profile.
      let solved=samples>=5;
      for(let column=0;solved && column<3;column++){
        let pivot=column;for(let row=column+1;row<3;row++)if(Math.abs(system[row][column])>Math.abs(system[pivot][column]))pivot=row;
        if(Math.abs(system[pivot][column])<1e-10){solved=false;break;}
        [system[pivot],system[column]]=[system[column],system[pivot]];
        const divisor=system[column][column];for(let j=column;j<4;j++)system[column][j]/=divisor;
        for(let row=0;row<3;row++)if(row!==column){const factor=system[row][column];for(let j=column;j<4;j++)system[row][j]-=factor*system[column][j];}
      }
      if(solved){
        const slope=system[1][3],length=Math.hypot(1,slope);
        nn[u]=(projected[u]-slope*tx)/length;nn[v]=(projected[v]-slope*ty)/length;
      }
      if(profile[i].ids.some(id=>nn.reduce((s,a,j)=>s+a*n[id*3+j],0)/Math.hypot(...n.slice(id*3,id*3+3))<.978))nn.splice(0,3,...projected);
      for(const id of profile[i].ids){
        const dot=nn.reduce((s,a,j)=>s+a*n[id*3+j],0)/Math.hypot(...n.slice(id*3,id*3+3));
        if(!Number.isFinite(dot) || dot<.978){invalid=true;break;}
        proposed.push([id,nn]);
      }
      if(invalid)break;
    }
    if(!invalid)for(const [id,nn] of proposed)output.set(nn,id*3);
  }
  return output;
}
