const fs = require('fs');
const path = require('path');

const botDataDir = path.join(__dirname, '.minecraft-bot');

// 获取所有JSON文件
const jsonFiles = fs.readdirSync(botDataDir)
  .filter(file => file.endsWith('.json'))
  .map(file => path.join(botDataDir, file));

// 删除所有JSON文件
jsonFiles.forEach(file => {
  try {
    fs.unlinkSync(file);
    console.log(`已删除: ${file}`);
  } catch (err) {
    console.error(`删除失败: ${file} - ${err.message}`);
  }
});

console.log(`\n清理完成，共删除 ${jsonFiles.length} 个JSON文件`);