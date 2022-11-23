
const fs = require('fs').promises
const path = require('path')
const Cluster = require('../cluster')

const ManualFile = 'manual.json'
const AutoFile = 'auto.json'

const $VaultPrefix = '$vault:'

module.exports = function (opts) {
  return async function () {
    opts.soa = await opts.soa
    const { _, s } = opts.soa
    const cfgutil = opts.config.util

    const secretPath = cfgutil.path('pvdev', 'cluster', opts.args.target, 'secret')
    opts.secretMap = JSON.parse(await fs.readFile(path.join(secretPath, 'secret.json'), 'utf8').catch(e => '{}'))
    opts.getVault = (password) => {
      return (s.startsWith(password, $VaultPrefix)
        ? opts.secretMap[s.strRight(password, ':')]
        : password)
    }

    // console.log('opts=', opts)
    const targetPath = cfgutil.path('pvdev', 'cluster', opts.args.target)

    opts.cluster = new Cluster(opts)

    const manual = JSON.parse(await fs.readFile(path.join(targetPath, ManualFile), 'utf-8').catch(e => '{}'))
    const auto = JSON.parse(await fs.readFile(path.join(targetPath, AutoFile), 'utf-8').catch(e => '{}'))

    const definition = _.merge(auto, manual)
    await opts.cluster.init(definition)
  }
}
