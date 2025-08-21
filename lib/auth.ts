interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export class TokenManager {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly tokenUrl: string;

  constructor(clientId: string, clientSecret: string, baseUrl: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    // Use the correct OAuth2 endpoint for Comcast gateway
    this.tokenUrl = 'https://sat-prod.codebig2.net/oauth/token';
    
    // Log the token URL for debugging
    console.log('OAuth2 Token URL:', this.tokenUrl);
  }

  async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Generate new token
    return this.generateNewToken();
  }

  private async generateNewToken(): Promise<string> {
    try {
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'x-client-id': this.clientId,
          'x-client-secret': this.clientSecret,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token generation failed: ${response.status} ${errorText}`);
      }

      const tokenData: TokenResponse = await response.json();
      
      this.accessToken = tokenData.access_token;
      // Set expiry to 5 minutes before actual expiry to be safe
      this.tokenExpiry = Date.now() + (tokenData.expires_in - 300) * 1000;
      
      return this.accessToken;
    } catch (error) {
      console.error('Failed to generate access token:', error);
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Method to force token refresh
  async refreshToken(): Promise<string> {
    this.accessToken = null;
    this.tokenExpiry = 0;
    return this.generateNewToken();
  }
}
