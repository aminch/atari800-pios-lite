#version 140

out vec4 FragColor;
in vec2 TexCoord;
uniform sampler2D ourTexture;
uniform float scanlinesFactor;
uniform float screenCurvature;
uniform vec2 u_resolution;
uniform float glowCoefficient; 
uniform float u_pixelSpread; 
uniform float u_glowCoeff;

vec2 barrel(vec2 v, vec2 resolution) {
    vec2 center = vec2(resolution.x / 2.0, resolution.y / 2.0);
    vec2 r2 = center - TexCoord;
    float distortion = dot(r2, r2) * screenCurvature;
    return v - r2 * (1.0 + distortion) * distortion;
}

float prodXY(vec2 v) {
	return v.x * v.y;
}

float maxXY(vec2 v) {
	return max(v.x, v.y);
}

float sum2(vec2 v) {
	return v.x + v.y;
}

vec2 positiveLog(vec2 x) {
	return clamp(log(x), vec2(0.0), vec2(100.0));
}

// draw CRT monitor frame with shadow and vignette
vec4 frame(vec2 texCoords, vec2 resolution) {
	if (screenCurvature == 0.0) return vec4(0.0,0.0,0.0,0.0);

	vec2 margin = vec2(0.0, 0.0);
	float frameShadowCoeff = 120.0;
	float screenShadowCoeff = 12.0;
	vec3 frameColor = vec3(0.3, 0.3, 0.35);

	vec2 coords = barrel(texCoords, resolution) * (vec2(1.0) + margin * 2.0) - margin;
	texCoords = texCoords / resolution;
	coords = coords / resolution;

	vec2 vignetteCoords = texCoords * (1.0 - texCoords.yx);
	float vignette = pow(prodXY(vignetteCoords) * 15.0, 0.25);

	vec3 color = frameColor * vec3(1.0 - vignette);
	float alpha = 0.0;

	float frameShadow = maxXY(positiveLog(-coords * frameShadowCoeff + 1.0) + positiveLog(coords * frameShadowCoeff - (frameShadowCoeff - 1.0)));
	frameShadow = max(sqrt(frameShadow), 0.0);
	color *= frameShadow;
	alpha = sum2(1.0 - step(vec2(0.0), coords) + step(vec2(1.0), coords));
	alpha = clamp(alpha, 0.0, 1.0);

	float screenShadow = 1.0 - prodXY(positiveLog(coords * screenShadowCoeff + vec2(1.0)) * positiveLog(-coords * screenShadowCoeff + vec2(screenShadowCoeff + 1.0)));
	// strength of screen shadow
	alpha = max(0.4 * screenShadow, alpha);

	return vec4(color * alpha, alpha);
}

// simulate CRT scan lines
float scanLines(vec2 screenCoords, vec2 texSize) {
	float coord = fract(screenCoords.y * texSize.y) * 2.0 - 1.0;
	return exp(-coord * coord * 1.75);
}

void main() {
	// texture size used:
    vec2 texSize = vec2(1024.0, 512.0);
	// part of the texture we actually need:
    vec2 texResolution = u_resolution / texSize; 
    
    vec2 texCoords = TexCoord;
    if (screenCurvature > 0.0) {
        // Apply original barrel warp to sampling coordinates
        texCoords = barrel(texCoords, texResolution);
    }

	vec4 pix = texture(ourTexture, texCoords);
	float mask = scanLines(texCoords, texSize);
	vec4 bgnd = mix(pix, pix * mask, scanlinesFactor);

    // Apply frame/bezel + vignette (alpha blend)
    vec4 frm = frame(TexCoord, texResolution);
    vec4 finalColor = mix(bgnd, frm, frm.a);
    FragColor = finalColor;
}
