import axios from 'axios';
import axiosRetry from 'axios-retry';
import Bottleneck from 'bottleneck';

const instance = axios.create({
  timeout: 15000,
  maxContentLength: 50 * 1024 * 1024, // 50MB
  maxBodyLength: 50 * 1024 * 1024,
});

axiosRetry(instance, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    const status = error?.response?.status;
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || (status >= 500 && status <= 599);
  },
});

const limiter = new Bottleneck({
  maxConcurrent: 5,
  minTime: 100,
});

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