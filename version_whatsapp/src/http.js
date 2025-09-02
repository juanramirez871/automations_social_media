import axios from 'axios';
import axiosRetry from 'axios-retry';
import Bottleneck from 'bottleneck';

// Axios instance with sane defaults
const instance = axios.create({
  timeout: 15000,
  maxContentLength: 50 * 1024 * 1024, // 50MB
  maxBodyLength: 50 * 1024 * 1024,
});

// Retries on network errors and 5xx responses
axiosRetry(instance, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    const status = error?.response?.status;
    // Retry on network errors, timeouts, and 5xx
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || (status >= 500 && status <= 599);
  },
});

// Basic rate limiting to avoid hitting platform limits
const limiter = new Bottleneck({
  maxConcurrent: 5,
  minTime: 100, // 10 req/second spread
});

// Thin wrapper exposing axios-like API scheduled via limiter
const http = {
  get(url, config = {}) {
    return limiter.schedule(() => instance.get(url, config));
  },
  post(url, data, config = {}) {
    return limiter.schedule(() => instance.post(url, data, config));
  },
  request(config) {
    return limiter.schedule(() => instance.request(config));
  },
};

export default http;