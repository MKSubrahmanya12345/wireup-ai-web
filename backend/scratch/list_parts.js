const mongoose = require('mongoose');
const uri = 'mongodb://mksubbu007:trial1@ac-cnp8zlk-shard-00-00.wtqndwb.mongodb.net:27017,ac-cnp8zlk-shard-00-01.wtqndwb.mongodb.net:27017,ac-cnp8zlk-shard-00-02.wtqndwb.mongodb.net:27017/test?ssl=true&replicaSet=atlas-zi4d72-shard-0&authSource=admin&retryWrites=true&w=majority';
mongoose.connect(uri).then(async () => {
  const parts = await mongoose.connection.db.collection('parts').find({
    $or: [
      { name: /arduino|esp32|pico|mega|nano|mcu/i },
      { mpn: /arduino|esp32|pico|mega|nano|mcu/i }
    ]
  }).toArray();
  console.log('MCU Parts in DB:', parts.map(p => ({ id: p._id, name: p.name, mpn: p.mpn })));
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
