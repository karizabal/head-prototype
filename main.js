import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const data = await d3.csv('data_binned_0.1.csv', d3.autoType);

const genres = Array.from(new Set(data.map(d => d.genre)));

const overallArr = d3.rollups(
  data,
  v => d3.mean(v, d => d.x_centered),
  d => d.time_bin
)
.map(([time, avg]) => ({ time, avg }))
.sort((a, b) => a.time - b.time);

const options = ['overall', ...genres];
d3.select('#controls')
  .append('label').text('options:')
  .append('select').attr('id','genre')
    .selectAll('option')
    .data(options)
    .join('option')
      .attr('value', d => d)
      .text(d => d);

const width = 400, height = 400;
const svg = d3.select('#vis').append('svg')
    .attr('width', width)
    .attr('height', height);

const projection = d3.geoOrthographic()
    .scale(180)
    .translate([width/2, height/2])
    .clipAngle(90);

const path = d3.geoPath(projection);
const sphereGeo = { type: 'Sphere' };

const defs = svg.append('defs');
const grad = defs.append('radialGradient').attr('id','shade');
grad.append('stop').attr('offset','20%').attr('stop-color','#E1F5FE');
grad.append('stop').attr('offset','80%').attr('stop-color','#81D4FA');

svg.append('path')
  .datum(sphereGeo)
  .attr('class','sphere')
  .attr('d', path)
  .attr('fill','url(#shade)')
  .attr('stroke','#666');

const graticule = d3.geoGraticule();
svg.append('path')
  .datum(graticule())
  .attr('class','graticule')
  .attr('fill','none')
  .attr('stroke','#666')
  .attr('stroke-width',0.5)
  .attr('d', path);

const eyePts = [{ lon:-25, lat:10 },{ lon:25, lat:10 }];
const cupR = 25;
const eyes = svg.selectAll('circle.eye')
  .data(eyePts)
  .join('circle')
    .attr('class','eye')
    .attr('r', cupR)
    .attr('fill','#333');

const avgXByGenre = { 'overall': overallArr };

genres.forEach(genre => {
  avgXByGenre[genre] = data
    .filter(d => d.genre === genre)
    .map(d => ({ time: d.time_bin, avg: d.x_centered }))
    .sort((a,b) => a.time - b.time);
});

// 7) smoothing
const smoothWindow = 2;
const smoothedXByGenre = {};
Object.entries(avgXByGenre).forEach(([genre, arr]) => {
  const n = arr.length;
  smoothedXByGenre[genre] = arr.map((d,i) => {
    const start = Math.max(0, i - smoothWindow);
    const end   = Math.min(n - 1, i + smoothWindow);
    const slice = arr.slice(start, end + 1);
    return { time: d.time, avg: d3.mean(slice, e => e.avg) };
  });
});

// 8) bisector
const bisect = d3.bisector(d => d.time).left;

// 9) animation
let timer;
function startAnim(sel) {
  if (timer) timer.stop();
  const arr = smoothedXByGenre[sel];
  const maxT = arr[arr.length - 1].time;
  const scaleDeg = 5;

  timer = d3.timer(elapsed => {
    const t = (elapsed/1000) % maxT;
    const i = bisect(arr, t);
    const curr = arr[i]     || arr[arr.length-1];
    const prev = arr[i-1]   || curr;
    const frac = (t - prev.time)/((curr.time - prev.time)||1);
    const avgX = prev.avg + (curr.avg - prev.avg) * frac;

    const rot = projection.rotate();
    projection.rotate([ avgX * scaleDeg, rot[1], rot[2] ]);

    svg.select('path.sphere').attr('d', path);
    svg.select('path.graticule').attr('d', path);
    eyes
      .attr('cx', d => projection([d.lon,d.lat])[0])
      .attr('cy', d => projection([d.lon,d.lat])[1]);
  });
}

d3.select('#genre')
  .on('change', function() { startAnim(this.value); })
  .property('value', 'overall');

startAnim(options[0]);
console.log('animation ready');