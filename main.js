import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// 1) Load your pre-binned CSV (time_bin in 0.1 s, x_centered already averaged)
const data = await d3.csv('data_binned_0.1.csv', d3.autoType);

// 2) Build the genre dropdown
const genres = Array.from(new Set(data.map(d => d.genre)));
d3.select('#controls')
  .append('label').text('Genre: ')
  .append('select').attr('id','genre')
    .selectAll('option')
    .data(genres)
    .join('option')
      .attr('value', d => d)
      .text(d => d);

// 3) Set up SVG + orthographic projection
const width = 400, height = 400;
const svg = d3.select('#vis')
  .append('svg')
    .attr('width', width)
    .attr('height', height);

const projection = d3.geoOrthographic()
  .scale(180)
  .translate([width/2, height/2])
  .clipAngle(90);

const path = d3.geoPath(projection);
const sphereGeo = { type: 'Sphere' };

// 4) Draw gradient sphere + “eyes” + graticule + red meridian
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

const cx = width/2, cy = height/2, r = 180;
const cupR = 25, dx = r*0.6, dy = r*0.4;

const graticule = d3.geoGraticule();
svg.append('path')
  .datum(graticule())
  .attr('class','graticule')
  .attr('fill','none')
  .attr('stroke','#666')
  .attr('stroke-width',0.5)
  .attr('d', path);

// red meridian at longitude 0°
  
const eyePts = [
  { lon: -25, lat:  10 },
  { lon:  25, lat:  10 }
];

const eyes = svg.selectAll('circle.eye')
  .data(eyePts)
  .join('circle')
    .attr('class','eye')
    .attr('r', cupR)
    .attr('fill','#333');


// 5) Build lookup: for each genre, an array [{time, avg},…]
const avgXByGenre = {};
genres.forEach(genre => {
  avgXByGenre[genre] = data
    .filter(d => d.genre === genre)
    .map(d => ({ time: d.time_bin, avg: d.x_centered }))
    .sort((a,b) => a.time - b.time);
});

// bisector for interpolation
const bisect = d3.bisector(d => d.time).left;

// 6) Animation: rotate yaw by avgX * scaleDeg
let timer;
function startAnim(genre) {
  if (timer) timer.stop();
  const arr = avgXByGenre[genre];
  const maxT = arr[arr.length - 1].time;
  // const scaleDeg = (180/Math.PI) / 100;
  const scaleDeg = 1;

  timer = d3.timer(elapsed => {
    const t = (elapsed / 1000) % maxT;
    const i = bisect(arr, t);
    const curr = arr[i]     || arr[arr.length - 1];
    const prev = arr[i - 1] || curr;
    const span = curr.time - prev.time || 1;
    const frac = (t - prev.time) / span;
    const avgX = prev.avg + (curr.avg - prev.avg) * frac;

    // yaw rotation (λ = avgX * scaleDeg)
    const rot = projection.rotate();
    projection.rotate([ avgX * scaleDeg, rot[1], rot[2] ]);

    // redraw everything
    svg.select('path.sphere').attr('d', path);
    svg.select('path.graticule').attr('d', path);

    eyes
      .attr('cx', d => projection([d.lon, d.lat])[0])
      .attr('cy', d => projection([d.lon, d.lat])[1]);
  });
}

// 7) Wire up & start default
d3.select('#genre')
  .on('change', function() { startAnim(this.value); })
  .property('value', genres[0]);

startAnim(genres[0]);

console.log('animation ready');