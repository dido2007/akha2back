const { reverseGeocoding } = require('./utils/utils');

async function run() {
  try {
    const result = await reverseGeocoding(36.8636907959613, 10.289039611816408);
    console.log(result);
  } catch (error) {
    console.error('Une erreur est survenue:', error);
  }
}

run();
