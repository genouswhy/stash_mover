# 游戏物品转移工具

一个用于在游戏中转移物品的Web工具，支持从储物箱到背包以及从背包到储物箱的物品转移操作。

## 功能

- 使用授权令牌验证用户身份
- 显示用户的背包和储物箱物品
- 支持物品多选和批量转移
- 可以搜索和筛选物品
- 可以为每个物品设置转移数量

## 部署

该应用程序已部署到Vercel，可以通过以下步骤部署自己的实例：

1. 安装Vercel CLI:
```
npm install -g vercel
```

2. 克隆此仓库:
```
git clone <repository-url>
cd stash_mover
```

3. 登录到Vercel:
```
vercel login
```

4. 部署:
```
vercel
```

## 本地开发

1. 创建虚拟环境:
```
python -m venv venv
source venv/bin/activate  # 在Windows上使用: venv\Scripts\activate
```

2. 安装依赖:
```
pip install -r requirements.txt
```

3. 运行应用:
```
python app.py
```

4. 访问 `http://localhost:8080`

## 许可证

MIT 