const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");


const ipLimiter = rateLimit({
    windowMs: 60 * 1000, 
    max: 30, 
    message: "Trop de requêtes depuis cet IP, IP ban def !",
    keyGenerator: function (req) {
      return req.ip; // Utilise l'IP comme clé
    }
});


const tokenLimiter = rateLimit({
    windowMs:  60 * 1000, 
    max: 25, 
    message: "Trop de requêtes avec ce token, compte ban",
    keyGenerator: function (req) {
      return req.headers['authorization'] || 'Unknown'; 
    }
});

const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 50,
    delayMs: 500 
});

const RequestLimitor = (req, res, next) => {
    ipLimiter(req, res, (err) => {
        if (err) return next(err);
        tokenLimiter(req, res, (err) => {
            if (err) return next(err);
            speedLimiter(req, res, next);
        });
    });
};

module.exports = RequestLimitor;
