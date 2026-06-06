# HomeComforts — 更新日志

## v1.0.4 (2026-06-03) — 3.11.4 稳定性修复版

### Bug 修复
- 删除不可用的 HandleFallPatch（引用了不存在的配置项）
- 删除未使用的 LayerSetterInfo 结构体

### 改进
- SafehouseSession.OnLastPlacedItemSpawned 移除冗余的 ContainsProfile() 检查
- SpaceHeaterAddonData 每次创建新实例，修复所有暖炉共享同一对象的潜在 Bug

### 依赖
- LeaveItThere >= 2.0.2（依赖其性能优化和 Bug 修复）

---

## v1.0.3 — 原始版本
- 初始 SPT 3.11.4 移植
