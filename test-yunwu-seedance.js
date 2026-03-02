// 测试云雾API Seedance模型视频生成
// 使用方法：在应用控制台运行此代码

// ⚠️ 不要把真实 API Key 提交到仓库。运行时在控制台手动替换为你的 Key。
const apiKey = 'YOUR_YUNWU_API_KEY_HERE';
const baseUrl = 'https://yunwu.apifox.cn';
const model = 'doubao-seedance-1-0-lite-i2v-250428';

console.log('=== 测试云雾API Seedance视频生成 ===');
console.log('Base URL:', baseUrl);
console.log('Model:', model);
console.log('\n--- 测试1: Volc格式 (Seedance标准格式) ---');

// Seedance模型应该使用volc格式
const volcBody = {
  model,
  content: [
    {
      type: 'text',
      text: '测试视频生成 --rs 720p --rt 16:9 --dur 5',
    },
  ],
};

console.log('Request Body:', JSON.stringify(volcBody, null, 2));

// 尝试volc格式端点
fetch(`${baseUrl}/volc/v1/contents/generations/tasks`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  },
  body: JSON.stringify(volcBody),
})
.then(async (resp) => {
  const text = await resp.text();
  console.log('Status:', resp.status);
  console.log('Response:', text.substring(0, 1000));
  
  if (resp.ok) {
    console.log('✅ Volc格式成功！');
    try {
      const data = JSON.parse(text);
      console.log('Task ID:', data.id || data.task_id);
    } catch (e) {
      console.log('Response不是JSON格式');
    }
  } else {
    // 如果Bearer格式失败，尝试其他格式
    if (resp.status === 401 || resp.status === 403) {
      console.log('\n--- 测试2: 尝试直接API Key格式 ---');
      
      const resp2 = await fetch(`${baseUrl}/volc/v1/contents/generations/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': apiKey, // 不带Bearer
        },
        body: JSON.stringify(volcBody),
      });
      
      const text2 = await resp2.text();
      console.log('Status:', resp2.status);
      console.log('Response:', text2.substring(0, 1000));
      
      if (resp2.ok) {
        console.log('✅ 直接API Key格式成功！');
      } else {
        console.log('\n--- 测试3: 尝试X-API-Key格式 ---');
        
        const resp3 = await fetch(`${baseUrl}/volc/v1/contents/generations/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-API-Key': apiKey,
          },
          body: JSON.stringify(volcBody),
        });
        
        const text3 = await resp3.text();
        console.log('Status:', resp3.status);
        console.log('Response:', text3.substring(0, 1000));
        
        if (resp3.ok) {
          console.log('✅ X-API-Key格式成功！');
        } else {
          console.log('\n--- 测试4: 尝试统一格式端点 ---');
          
          // 如果volc格式都不行，尝试统一格式
          const unifiedBody = {
            model,
            prompt: '测试视频生成',
            metadata: {
              aspect_ratio: '16:9',
            },
            duration: 5,
          };
          
          const resp4 = await fetch(`${baseUrl}/v1/video/generations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(unifiedBody),
          });
          
          const text4 = await resp4.text();
          console.log('Status:', resp4.status);
          console.log('Response:', text4.substring(0, 1000));
          
          if (resp4.ok) {
            console.log('✅ 统一格式成功！');
          } else {
            console.log('❌ 所有格式都失败了');
            console.log('请检查：');
            console.log('1. API Key是否正确');
            console.log('2. API Key是否有视频生成权限');
            console.log('3. 模型名称是否正确');
            console.log('4. baseUrl是否正确');
          }
        }
      }
    }
  }
})
.catch(err => {
  console.error('❌ 请求失败:', err);
});
