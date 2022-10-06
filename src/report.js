
let chalkInstance = null
async function getChalk () {
  if (!chalkInstance) {
    chalkInstance = (await import('chalk')).default
  }
  return chalkInstance
}

const logger = require('fancy-log')
// 下两句将使得自定义报告结果与默认gulp保持一致。
// const util = require('util')
// util.inspect.styles.date = 'gray'

module.exports = function (opts) {
  return async function () {
    const chalk = await getChalk()
    logger('enter reporter')
    logger(chalk.blue('Hello') + ' World' + chalk.red('!'))
    // cb()
  }
}
