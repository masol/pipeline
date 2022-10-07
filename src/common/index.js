
module.exports = function (opts) {
  return async function () {
    opts.soa = await opts.soa
  }
}
