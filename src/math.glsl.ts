export const MATH_GLSL = `
const float PI = 3.141592653589793115997963468544185161590576171875;
const float PI_2 = PI/2.0;
const float TAU = 2.0*PI;
const float E = 2.718281828459045090795598298427648842334747314453125;
const float ONE = 1.0;
const float ZERO = 0.0;
const float LN10 = 2.30258509299;

//ONE ARGUMENT PRIMITIVES
float fexp(float x) { return exp(x); }
float fminus(float x) { return -x; }
float fln(float x) { 
    if(x <= 0.0)
        return -1e1000;
    return log(x);    
}
float fsqrt(float x) {
    if(x < 0.0)
        return -1e1000;
    return sqrt(x);
}
float fpow(float base, float ex) {
    return pow(base, ex);
}
float ffloor(float x) {
    int n = int(x);
    return float(n);
}
float fceil(float x) {
    float frac = fract(x);
    int n = int(x);
    if(frac > 1e-10) n++;
    return float(n);
}
bool fneg(float x) {
    if(x < 0.0) 
        return true;
    return false;
}

//TWO ARGUMENT PRIMITIVES
float fadd(float x, float y) { return x + y; }
float fmul(float x, float y) { return x * y; }
float fdiv(float x, float y) {return x / y; }

float fsub(float x, float y) {
    return fadd(x, fminus(y));
}
float fmod(float x, float y) {
    float res = fsub(x, fmul(y, ffloor(fdiv(x, y))));
    if(res < 0.0)
        res = fadd(res, y);
    return res;
}

float flog(float x) {
    return fdiv(fln(x), LN10);
}
float flog(float x, float base) {
    return fdiv(fln(x), fln(base));
}

float fabs(float x) {
    if(fneg(x)) 
        return fminus(x);
    return x;
}

const float[] atanInverse2n = float[32](0.7853981633974483, 0.4636476090008061, 0.24497866312686414, 0.12435499454676144, 0.06241880999595735, 0.031239833430268277, 0.015623728620476831, 0.007812341060101111, 0.0039062301319669718, 0.0019531225164788188, 0.0009765621895593195, 0.0004882812111948983, 0.00024414062014936177, 0.00012207031189367021, 6.103515617420877e-05, 3.0517578115526096e-05, 1.5258789061315762e-05, 7.62939453110197e-06, 3.814697265606496e-06, 1.907348632810187e-06, 9.536743164059608e-07, 4.7683715820308884e-07, 2.3841857910155797e-07, 1.1920928955078068e-07, 5.960464477539055e-08, 2.9802322387695303e-08, 1.4901161193847655e-08, 7.450580596923828e-09, 3.725290298461914e-09, 1.862645149230957e-09, 9.313225746154785e-10, 4.656612873077393e-10);
const float[] inverse2n = float[32](1.0, 0.5, 0.25, 0.125, 0.0625, 0.03125, 0.015625, 0.0078125, 0.00390625, 0.001953125, 0.0009765625, 0.00048828125, 0.000244140625, 0.0001220703125, 6.103515625e-05, 3.0517578125e-05, 1.52587890625e-05, 7.62939453125e-06, 3.814697265625e-06, 1.9073486328125e-06, 9.5367431640625e-07, 4.76837158203125e-07, 2.384185791015625e-07, 1.1920928955078125e-07, 5.960464477539063e-08, 2.9802322387695312e-08, 1.4901161193847656e-08, 7.450580596923828e-09, 3.725290298461914e-09, 1.862645149230957e-09, 9.313225746154785e-10, 4.656612873077393e-10);

vec2 cordic(float theta) {
    float angle = theta;
    float x = 0.6072529350088812;
    float y = 0.0;
    float change = 1.0;

    for(int i=0; i<32; ++i) {
        float d = (angle > 0.0)? 1.0 : -1.0;

        float dx = d * y * inverse2n[i];
        float dy = d * x * inverse2n[i];

        x -= dx;
        y += dy;
        angle -= d * atanInverse2n[i];
        change = abs(dx) + abs(dy);
    }

    return vec2(x, y);
}

float fsin(float x) {
    float xmodpi2 = fmod(x, PI_2);
    float xmodpi = fmod(x, PI);
    float xmodtau = fmod(x, TAU);

    if(xmodpi > xmodpi2) {
        x = PI_2 - xmodpi2;
    } else {
        x = xmodpi2;
    }
    
    float result = cordic(x).y;
    
    if(xmodtau > xmodpi) {
        return -result;
    } else {
        return result;
    }
}

float fcos(float x) {
    float xmodpi2 = fmod(x, PI_2);
    float xmodpi = fmod(x, PI);
    float xmodtau = fmod(x, TAU);

    if(xmodpi > xmodpi2) {
        x = PI_2 - xmodpi2;
    } else {
        x = xmodpi2;
    }

    float result = cordic(x).x;

    if(xmodtau > PI_2 && xmodtau < TAU-PI_2)
        return -result;
    else
        return result;
}
`