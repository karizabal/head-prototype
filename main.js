import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

(async function() {
  // 1) Load & type-cast
  const data = await d3.csv('data_binned_0.1.csv', d => ({
    time_bin:   +d.time_bin,
    x_centered: +d.x_centered,
    y_centered: +d.y_centered,
    z_centered: +d.z_centered,
    genre:       d.genre
  }));

  // 2) Genre picker UI
  const genres = Array.from(new Set(data.map(d => d.genre)));
  let current = null;
  const list = d3.select('#genre-list-ios');
  function renderList() {
    const items = list.selectAll('.item')
      .data(genres, d => d)
      .join('div')
        .attr('class', d => d === current ? 'item selected' : 'item')
        .on('click', (_, d) => {
          current = current === d ? null : d;
          startAnim(current);
          renderList();
        });
    items.selectAll('.label')
      .data(d => [d]).join('span')
        .attr('class','label').text(d => d);
    items.selectAll('.icon')
      .data(d => [d]).join('span')
        .attr('class','icon')
        .text(d => d === current ? '⏸︎' : '▶︎');
  }
  renderList();

  // 3) SVG & projection
  const W = 400, H = 400;
  const svg = d3.select('#vis').append('svg')
      .attr('width', W).attr('height', H)
      .style('overflow','visible');

  const projection = d3.geoOrthographic()
      .scale(110)
      .translate([W/2, H/2])
      .clipAngle(90);
  const path = d3.geoPath(projection);

  // 4) Global defs
  const defs = svg.append('defs');
  const grad = defs.append('radialGradient').attr('id','shade');
  grad.append('stop').attr('offset','20%').attr('stop-color','#FFF176');
  grad.append('stop').attr('offset','80%').attr('stop-color','#FDD835');

  // 5) Head group
  const head = svg.append('g').attr('class','head');

  // 6) Draw sphere + grid inside head
  head.append('path')
    .datum({type:'Sphere'})
    .attr('class','sphere')
    .attr('d', path)
    .attr('fill','url(#shade)')
    .attr('stroke','#666');

  head.append('path')
    .datum(d3.geoGraticule()())
    .attr('class','graticule')
    .attr('fill','none')
    .attr('stroke','#666')
    .attr('stroke-width',0.5)
    .attr('d', path);

  // 7) Draw eyes once inside head
  const eyePts = [{lon:-25,lat:10},{lon:25,lat:10}];
  head.selectAll('circle.eye')
    .data(eyePts)
    .join('circle')
      .attr('class','eye')
      .attr('r', 15)
      .attr('fill','#333')
      .attr('cx', d => projection([d.lon,d.lat])[0])
      .attr('cy', d => projection([d.lon,d.lat])[1]);

  // 8) Prepare per-genre & overall series (sorted)
  const avg = { x: {}, y: {}, z: {} };
  ['x_centered','y_centered','z_centered'].forEach(axis=>{
    const key = axis.split('_')[0]; // 'x','y','z'
    genres.forEach(g => {
      avg[key][g] = data
        .filter(d=>d.genre===g)
        .map(d => ({ time:d.time_bin, avg:d[axis] }))
        .sort((a,b) => a.time - b.time);
    });
    avg[key]['Overall'] = d3.rollups(
      data,
      vs => d3.mean(vs, d=>d[axis]),
      d=>d.time_bin
    )
    .map(([t,a])=>({time:t,avg:a}))
    .sort((a,b) => a.time - b.time);
  });

  // 9) Smooth: X/Z ±2 bins, Y ±5 bins
  function smooth(arr, w) {
    const n = arr.length;
    return arr.map((d,i) => {
      const start = Math.max(0,i-w), end = Math.min(n-1,i+w);
      const slice = arr.slice(start,end+1);
      return { time:d.time, avg:d3.mean(slice, e=>e.avg) };
    });
  }
  const sm = { x:{}, y:{}, z:{} };
  ['x','y','z'].forEach(k=>{
    Object.keys(avg[k]).forEach(g => {
      sm[k][g] = smooth(avg[k][g], k==='y' ? 10 : 2);
    });
  });

  // 10) Bisector
  const bisect = d3.bisector(d=>d.time).left;

  // 11) Animation: translate X/Z & scale Y
  let timer;
  function startAnim(sel) {
    if (timer) timer.stop();
    const key = sel || 'Overall';
    const sx = sm.x[key], sy = sm.y[key], sz = sm.z[key];
    const maxT = sx[sx.length-1].time;

    const xScale = 20,    // px per mm X
          zScale = 30,    // px per mm Z
          yScale = 0.05;  // scale per mm Y

    timer = d3.timer(elapsed => {
      const t = (elapsed/1000) % maxT;
      function interp(arr) {
        const i = bisect(arr,t),
              cur = arr[i]     || arr[arr.length-1],
              prev= arr[i-1]   || cur,
              span= cur.time - prev.time || 1,
              frac= (t - prev.time)/span;
        return prev.avg + (cur.avg - prev.avg)*frac;
      }
      const dx = interp(sx) * xScale;
      const dy = interp(sz) * zScale;
      const sc = 1 + interp(sy) * yScale;

      head.attr('transform', `translate(${dx},${dy}) scale(${sc})`);
    });
  }

  startAnim(null);
  console.log('animation ready with smoother Y-axis');
})();
