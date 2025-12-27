// Supabase客户端配置
// 用户需要自行配置以下两个变量：
// 1. SUPABASE_URL - 从Supabase项目设置中获取
// 2. SUPABASE_ANON_KEY - 从Supabase项目设置中获取（Public Anon Key）

// TODO: 请替换为你的Supabase项目URL
const SUPABASE_URL = 'https://mcrdmzlblxqzcmankogx.supabase.co';

// TODO: 请替换为你的Supabase Public Anon Key
const SUPABASE_ANON_KEY = 'sb_publishable_s0VxUFCzKJXimqeR2tjirw_-0DP_06u';

// 初始化Supabase客户端
// 注意：需要从CDN引入Supabase客户端库
// 在HTML中添加: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
let supabaseClient = null;

try {
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.error('Supabase客户端库未加载，请确保在HTML中引入了@supabase/supabase-js');
    }
} catch (error) {
    console.error('Supabase客户端初始化失败:', error);
}

// 导出Supabase客户端
if (typeof window !== 'undefined') {
    window.supabaseClient = supabaseClient;
}

