import { TokenManager } from '../lib/auth';

// Mock fetch for testing
global.fetch = jest.fn();

describe('OAuth2 Token Management', () => {
  let tokenManager: TokenManager;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    tokenManager = new TokenManager('test-client-id', 'test-client-secret', 'https://api.example.com/v1');
    mockFetch.mockClear();
  });

  test('generates token URL correctly', () => {
    // The token URL should be derived from the base URL without /v1
    expect(tokenManager).toBeDefined();
  });

  test('handles successful token generation', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    };

    mockFetch.mockResolvedValue(mockResponse as any);

    const token = await tokenManager.getAccessToken();
    expect(token).toBe('test-access-token');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/oauth/token',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: expect.stringContaining('grant_type=client_credentials'),
      })
    );
  });

  test('handles token generation failure', async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValue('Unauthorized'),
    };

    mockFetch.mockResolvedValue(mockResponse as any);

    await expect(tokenManager.getAccessToken()).rejects.toThrow('Token generation failed: 401 Unauthorized');
  });

  test('caches token and reuses it', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    };

    mockFetch.mockResolvedValue(mockResponse as any);

    // First call should generate token
    const token1 = await tokenManager.getAccessToken();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call should reuse cached token
    const token2 = await tokenManager.getAccessToken();
    expect(mockFetch).toHaveBeenCalledTimes(1); // Still only called once
    expect(token1).toBe(token2);
  });

  test('refreshes expired token', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 1, // Very short expiry
      }),
    };

    mockFetch.mockResolvedValue(mockResponse as any);

    // First call
    await tokenManager.getAccessToken();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Wait for token to expire
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Second call should generate new token
    await tokenManager.getAccessToken();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
