export const T_FRAGMENT_GLSL = `#version 300 es

precision highp float;
precision highp int;

#define TEO_WIDTH 1.0
#define AA 4
#define SIDE %side%
#define MAX_EXPR 256

#define INV_LN10 0.4342944819

#define FLT_MAX 3.402823466e+38
#define FLT_MIN 1.175494351e-38

uniform ivec2 origin;
uniform int squareMant, squareExp, squareSize;
uniform int maxExpr;
uniform vec4 expressions[MAX_EXPR];

const int WIDTH = int(TEO_WIDTH*float(AA)); 

int fneg(float x) { return (x < 0.0)? 1:0; }

float ln(float x) { return (x <= 0.0)? FLT_MIN : log(x); }

float log10(float x) { return (x <= 0.0)? FLT_MIN : (INV_LN10 * log(x)) ; }

float sqrtf(float x) { return (x <= 0.0)? FLT_MIN : sqrt(x); }

//To change dinamically the eval function
ivec2 eval(ivec2 p, int opt) {
    float pixel = (float(squareMant) * pow(10.0, float(squareExp))) / float(squareSize); 
    float unit = pixel/float(AA);
    float x = float(p.x)*unit, y = float(p.y)*unit;

    ivec2 ret;

    switch(opt) {
        %REPLACE_CODE%
        
    default:
        break;
    }

    return ret;
}

bool line(ivec2 p, int opt) {
    ivec2 a = eval(p + ivec2(-WIDTH, -WIDTH), opt);
    ivec2 b = eval(p + ivec2(WIDTH+1, WIDTH+1), opt);
    ivec2 c = eval(p + ivec2(-WIDTH, WIDTH+1), opt);
    ivec2 d = eval(p + ivec2(WIDTH+1, -WIDTH), opt);

    int g = a.x + b.x + c.x + d.x;
    bool denominators = a.y == b.y && b.y == c.y && c.y == d.y;

    return 0 < g && g < 4 && denominators;
}

vec4 lineColor(ivec2 p, int opt, vec3 rgb) {
    int count = 0;
    for(int i=0; i<AA; ++i) {
        for(int j=0; j<AA; ++j) {
            ivec2 np = p + ivec2(i, j);
            count += int(line(np, opt));
        }
    }

    float alpha = float(count)/float(AA*AA);
    return vec4(rgb*alpha, alpha);
}


vec4 blend(vec4 a, vec4 b) {
    float p = a.a, q = 1.0-p;
    return vec4(
        a.r*p + b.r*q,
        a.g*p + b.g*q,
        a.b*p + b.b*q,
        a.a*p + b.a*q
    );
}

out vec4 fragColor;

void main() {
    ivec2 p = ivec2(
        int(gl_FragCoord.x) - origin.x, 
        int(gl_FragCoord.y) + origin.y - SIDE
    ) * AA;
    vec4 color = vec4(0.0, 0.0, 0.0, 0.0);

    for(int i=0; i<MAX_EXPR; i++) {
        if(i >= maxExpr) break;
        if(expressions[i].a < 0.9) continue;
        
        vec3 rgbColor = expressions[i].rgb;
        color = blend(color, lineColor(p, i, rgbColor));
    }

    fragColor = color;
}

`