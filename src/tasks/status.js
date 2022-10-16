
module.exports = function (opts) {
  return async function () {
    const { cluster } = opts

    return await cluster.fetch()
  }
}
