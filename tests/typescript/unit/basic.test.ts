import { MonitoringState } from '../../../src/types/stock';

describe('基本测试', () => {
  test('MonitoringState枚举应该正确', () => {
    expect(MonitoringState.STOPPED).toBe('stopped');
    expect(MonitoringState.RUNNING).toBe('running');
    expect(MonitoringState.ERROR).toBe('error');
  });

  test('简单数学运算', () => {
    expect(1 + 1).toBe(2);
    expect(10 * 10).toBe(100);
  });

  test('异步测试', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });

  test('对象比较', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, b: 2 };
    expect(obj1).toEqual(obj2);
  });
});