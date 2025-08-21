import OpenAI from 'openai';
import { TokenManager } from './auth';

let tokenManager: TokenManager | null = null;

export async function createOpenAIClient(): Promise<OpenAI> {
  const mode = process.env.MODE;
  
  if (mode === 'gateway') {
    const baseURL = process.env.OPENAI_BASE_URL;
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    
    if (!baseURL || !clientId || !clientSecret) {
      throw new Error('OPENAI_BASE_URL, CLIENT_ID, and CLIENT_SECRET are required for gateway mode');
    }
    
    // Initialize token manager if not already done
    if (!tokenManager) {
      tokenManager = new TokenManager(clientId, clientSecret, baseURL);
    }
    
    // Get the access token
    const accessToken = await tokenManager.getAccessToken();
    
    return new OpenAI({
      apiKey: '1', // Dummy key for gateway mode
      baseURL,
      defaultHeaders: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });
  } else {
    // Default to direct mode
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for direct mode');
    }
    
    return new OpenAI({
      apiKey,
    });
  }
}

export async function getGatewayHeaders(): Promise<Headers> {
  if (!tokenManager) {
    throw new Error('Token manager not initialized. Make sure MODE=gateway is set.');
  }
  
  const accessToken = await tokenManager.getAccessToken();
  console.log('🔍 Generated access token:', accessToken.substring(0, 50) + '...');
  
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${accessToken}`);
  return headers;
}
