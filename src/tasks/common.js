
const fs = require('fs').promises
const path = require('path')
const Cluster = require('../cluster')

const ManualFile = 'manual.json'
const AutoFile = 'auto.json'
module.exports = function (opts) {
  return async function () {
    opts.soa = await opts.soa
    const { _ } = opts.soa
    const util = opts.config.util
    // console.log('opts=', opts)
    const targetPath = util.path('pvdev', 'cluster', opts.args.target)

    opts.cluster = new Cluster(opts)

    const manual = JSON.parse(await fs.readFile(path.join(targetPath, ManualFile), 'utf-8').catch(e => '{}'))
    const auto = JSON.parse(await fs.readFile(path.join(targetPath, AutoFile), 'utf-8').catch(e => '{}'))

    const definition = _.merge(auto, manual)
    await opts.cluster.init(definition)
  }
}
