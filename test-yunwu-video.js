// 测试云雾API视频生成功能
// 使用方法：在应用设置中配置好云雾API的API Key后，运行此脚本

const testYunwuVideoGeneration = async () => {
  // 请替换为你在设置中配置的云雾API的API Key
  const apiKey = 'YOUR_YUNWU_API_KEY_HERE';
  const baseUrl = 'https://yunwu.apifox.cn';
  const model = 'your-video-model'; // 请替换为实际的视频模型名称
  
  const prompt = '一个美丽的风景，阳光明媚，微风轻拂';
  const aspectRatio = '16:9';
  const duration = 5;
  
  const body = {
    model,
    prompt,
    metadata: {
      aspect_ratio: aspectRatio,
    },
    duration,
  };
  
  console.log('=== 测试云雾API视频生成 ===');
  console.log('Base URL:', baseUrl);
  console.log('Model:', model);
  console.log('Request Body:', JSON.stringify(body, null, 2));
  console.log('\n--- 尝试格式1: Bearer Token ---');
  
  // 格式1: Bearer Token
  try {
    const resp1 = await fetch(`${baseUrl}/v1/video/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    
    const text1 = await resp1.text();
    console.log('Status:', resp1.status);
    console.log('Response:', text1.substring(0, 500));
    
    if (resp1.ok) {
      console.log('✅ Bearer格式成功！');
      const data = JSON.parse(text1);
      console.log('Task ID:', data.task_id || data.id);
      return;
    }
    
    if (resp1.status === 401 || resp1.status === 403) {
      console.log('\n--- 尝试格式2: 直接API Key ---');
      
      // 格式2: 直接API Key（不带Bearer）
      const resp2 = await fetch(`${baseUrl}/v1/video/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': apiKey,
        },
        body: JSON.stringify(body),
      });
      
      const text2 = await resp2.text();
      console.log('Status:', resp2.status);
      console.log('Response:', text2.substring(0, 500));
      
      if (resp2.ok) {
        console.log('✅ 直接API Key格式成功！');
        const data = JSON.parse(text2);
        console.log('Task ID:', data.task_id || data.id);
        return;
      }
      
      console.log('\n--- 尝试格式3: X-API-Key Header ---');
      
      // 格式3: X-API-Key Header
      const resp3 = await fetch(`${baseUrl}/v1/video/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(body),
      });
      
      const text3 = await resp3.text();
      console.log('Status:', resp3.status);
      console.log('Response:', text3.substring(0, 500));
      
      if (resp3.ok) {
        console.log('✅ X-API-Key格式成功！');
        const data = JSON.parse(text3);
        console.log('Task ID:', data.task_id || data.id);
        return;
      }
      
      console.log('\n❌ 所有格式都失败了');
      console.log('请检查：');
      console.log('1. API Key是否正确');
      console.log('2. API Key是否有视频生成权限');
      console.log('3. 模型名称是否正确');
      console.log('4. baseUrl是否正确（应该是 https://yunwu.apifox.cn）');
    }
  } catch (error) {
    console.error('❌ 请求失败:', error);
  }
};

// 如果在Node.js环境中运行
if (typeof window === 'undefined') {
  const fetch = require('node-fetch');
  testYunwuVideoGeneration().catch(console.error);
} else {
  // 如果在浏览器环境中运行
  window.testYunwuVideoGeneration = testYunwuVideoGeneration;
  console.log('测试函数已加载，在控制台运行: testYunwuVideoGeneration()');
}
