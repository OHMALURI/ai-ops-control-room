import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8000/api',
});

// Detect naive ISO strings without timezone offsets (e.g. "2026-03-26T13:41:00")
const naiveIsoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

function appendZuluTime(obj) {
    if (obj === null || typeof obj !== 'object') return;
    
    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            if (typeof obj[i] === 'string' && naiveIsoRegex.test(obj[i])) {
                obj[i] += 'Z';
            } else if (typeof obj[i] === 'object') {
                appendZuluTime(obj[i]);
            }
        }
    } else {
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                if (typeof obj[key] === 'string' && naiveIsoRegex.test(obj[key])) {
                    obj[key] += 'Z';
                } else if (typeof obj[key] === 'object') {
                    appendZuluTime(obj[key]);
                }
            }
        }
    }
}

api.interceptors.response.use(
    (response) => {
        if (response.data) {
            appendZuluTime(response.data);
        }
        return response;
    },
    (error) => Promise.reject(error)
);

export default api;
