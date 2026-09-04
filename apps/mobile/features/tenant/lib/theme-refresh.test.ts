import { requestThemeRefresh, setThemeRefreshHandler } from './theme-refresh';

describe('theme-refresh', () => {
  afterEach(() => {
    setThemeRefreshHandler(null);
  });

  it('chama o handler registrado quando requestThemeRefresh é invocado', () => {
    const handler = jest.fn();
    setThemeRefreshHandler(handler);

    requestThemeRefresh();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('não lança quando nenhum handler está registrado', () => {
    expect(() => requestThemeRefresh()).not.toThrow();
  });

  it('para de chamar o handler antigo depois que ele é substituído por null', () => {
    const handler = jest.fn();
    setThemeRefreshHandler(handler);
    setThemeRefreshHandler(null);

    requestThemeRefresh();

    expect(handler).not.toHaveBeenCalled();
  });
});
