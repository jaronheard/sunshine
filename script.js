/* eslint-env node, browser */
/* global d3 */

// date utilities
const now = new Date(1970, 0, 1);
const parseTime = d3.timeParse("%m-%d-%Y-%H:%M");
const parseUTCTime = d3.utcParse("%m-%d-%Y-%H:%M");
const parseSunDate = d3.timeParse("%m-%d-%Y");
const formatHour = d3.utcFormat("%-I:%M %p");
const formatMonth = d3.utcFormat("%B");

const shiftToUTCHours = function shiftToUTCHours(t, adjustment) {
  const d = new Date(1970, 0, 1);
  const h = t.getUTCHours() + adjustment - d.getTimezoneOffset() / 60;
  const m = t.getUTCMinutes();
  return new Date(1970, 0, 1, h, m);
};

// request and log sample weather data
function logSampleWeatherData() {
  const ssv = d3.dsvFormat(" ");
  d3.request(cityURLs.portlandWeather)
    .mimeType("text/plain")
    .response((xhr) => {
      const dirtyTxt = xhr.responseText;
      const cleanTxt = dirtyTxt
        .split("\n")
        .map((z) => z.slice(13))
        .join("\n");
      const cleanerTxt = cleanTxt.replace(/  +/g, " ");
      return ssv.parse(cleanerTxt);
    })
    .get((data) => {
      console.log("space-delimited test data:");
      console.log(data[395]);
    });
}

// margins and dimensions
const svgWidth = 960;
const svgHeight = 500;

const margin = {
  top: 20,
  right: 0,
  bottom: 20,
  left: 70,
};

const width = svgWidth - margin.left - margin.right;
const height = svgHeight - margin.top - margin.bottom;

// scales
const x = d3.scaleUtc().rangeRound([0, width + 10]);
const y = d3
  .scaleUtc()
  .domain([d3.utcDay.floor(now), d3.utcDay.ceil(now)])
  .rangeRound([0, height - 32]);

// constants
const cityURLs = {
  portland:
    "https://gist.githubusercontent.com/jaronheard/99be6944675abdeb7b02e15f3430114c/raw/2d169f545a4d95762a500cd8b17418273eafa051/portland2011cloudcover.csv",
  portlandSunriseSunset:
    "https://gist.githubusercontent.com/jaronheard/0f7ed3b23e56d01fba20c2d4934ce645/raw/2783170b18313f6d9d2cd0fe750bfdbdfd1c56ea/portland2011sunrisesunset.csv",
  portlandWeather:
    "https://gist.githubusercontent.com/jaronheard/700042270c68fece9043a4d406a74bfb/raw/bf52c81394c6ba32dda085ecf383775ce84d666d/portland2011weather.txt",
  la: "https://gist.githubusercontent.com/jaronheard/11178a52980eaa8d3f8066617cb34921/raw/0ad3046c3f480a709a02c0caccc7295a9c9f4dd8/la2011cloudcover.csv",
  laSunriseSunset:
    "https://gist.githubusercontent.com/jaronheard/b44a19296d197b2c9f78a8fc28a14629/raw/29ec51fbbe0c17962e258365c5585f86a770c4cb/la2011sunrisesunset.csv",
  nySunriseSunset:
    "https://gist.githubusercontent.com/jaronheard/c9a7dc7666b88310802c1817f58d8c12/raw/9674f8af27eb1c9755b35631a2ad0af01e0f13ea/ny2011sunrisesunset.csv",
  ny: "https://gist.githubusercontent.com/jaronheard/9f3b768b63a94b29ebfccce5b13c74fe/raw/63041e04b341c5c826ef6d4e924bcfb3fd89dc06/ny2011cloudcover.csv",
};

const cityTitles = {
  portland: "🌤️ Portland Sunshine & Cloud Cover",
  la: "🌤️ Los Angeles Sunshine & Cloud Cover",
  ny: "🌤️ New York Sunshine & Cloud Cover",
};

// data processing functions
function processSunData(d) {
  const sunData = d;
  sunData.day = parseSunDate(d.Date);
  sunData.rise = parseUTCTime(`${d.Date}-${d.Sunrise}`);
  sunData.set = parseUTCTime(`${d.Date}-${d.Sunset}`);
  return sunData;
}

function processCloudData(d) {
  const cloudChunks = 4;
  const cloudData = d;
  const c = parseInt(d.CloudCover, 10);
  cloudData.cloud = Math.round(c / (200 / cloudChunks)) * (200 / cloudChunks);
  cloudData.time = parseUTCTime(d.Date);
  cloudData.timeLocal = parseTime(d.Date);
  return cloudData;
}

window.onload = function onload() {
  function renderViz(g, city = "portland") {
    d3.csv(cityURLs[city], processCloudData, (error, data) => {
      if (error) throw error;

      const date0 = data[0].time;
      const date1 = data[data.length - 1].time;

      x.domain([date0, date1]).nice();

      const cover = g.selectAll(".cover").data(data);

      cover.attr("fill", (d) => d3.interpolateGreys(d.cloud / 100));

      cover
        .enter()
        .append("rect")
        .attr("width", 5)
        .attr("height", 20)
        .attr("x", (d) => x(d.timeLocal))
        .attr("y", (d) => {
          const yToFit = y(shiftToUTCHours(d.time, 0));
          return yToFit;
        })
        .attr("class", "cover")
        .attr("fill", (d) =>
          d3.interpolateGreys(Math.round(d.cloud / 1) / 100)
        );

      cover.exit().remove();

      d3.csv(
        cityURLs[`${city}SunriseSunset`],
        processSunData,
        (error, data) => {
          if (error) throw error;

          const setArea = d3
            .area()
            .x((d) => x(d.day))
            .y1((d) => y(shiftToUTCHours(d.set, 0)))
            .y0((d) => y(d3.utcDay.ceil(shiftToUTCHours(d.set, 0))) + 20);

          const riseArea = d3
            .area()
            .x((d) => x(d.day))
            .y1((d) => y(shiftToUTCHours(d.rise, 0)))
            .y0((d) => y(d3.utcDay.floor(shiftToUTCHours(d.rise, 0))));

          const riseLine = d3
            .line()
            .x((d) => x(d.day))
            .y((d) => y(shiftToUTCHours(d.rise, 0)));

          const setLine = d3
            .line()
            .x((d) => x(d.day))
            .y((d) => y(shiftToUTCHours(d.set, 0)));

          g.selectAll("path").remove();

          g.append("path")
            .datum(data)
            .attr("d", setArea)
            .attr("class", "sunriseareapath");

          g.append("path")
            .datum(data)
            .attr("d", riseArea)
            .attr("class", "sunriseareapath");

          g.append("path")
            .datum(data)
            .attr("d", riseLine)
            .attr("class", "sunriseline");

          g.append("path")
            .datum(data)
            .attr("d", setLine)
            .attr("class", "sunriseline");

          g.selectAll("g").remove();

          // g.append("g")
          //   .attr("class", "axis axis--x")
          //   .attr("transform", `translate(0,${height})`)
          //   .call(
          //     d3
          //       .axisBottom(x)
          //       .tickFormat(formatMonth)
          //       .tickSize(-height)
          //       .tickPadding(-10)
          //   )
          //   .selectAll("text")
          //   .attr("text-anchor", "start")
          //   .attr("x", 10)
          //   .attr("dy", null);

          // g.append("g")
          //   .attr("class", "axis axis--y")
          //   .call(
          //     d3
          //       .axisLeft(y)
          //       .tickFormat(formatHour)
          //       .tickSize(-width)
          //       .tickPadding(10)
          //   );
        }
      );
    });
  }

  const pdxSvg = d3.select("#pdxViz");
  const g = pdxSvg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  renderViz(g, "portland");

  // create two additional copies of the rendered viz in separate containers
  const laSvg = d3.select("#laViz");
  const laG = laSvg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  renderViz(laG, "la");

  const nySvg = d3.select("#nyViz");
  const nyG = nySvg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  renderViz(nyG, "ny");
};
