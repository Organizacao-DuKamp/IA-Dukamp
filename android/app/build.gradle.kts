plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
if (file("google-services.json").exists()) apply(plugin = "com.google.gms.google-services")
android {
    namespace = "br.com.tpecia.fazenda"
    compileSdk = 36
    buildToolsVersion = "36.0.0"
    defaultConfig {
        applicationId = "br.com.tpecia.fazenda"
        minSdk = 26
        targetSdk = 36
        versionCode = 6
        versionName = "1.2.0"
        buildConfigField("String", "PANEL_ORIGIN", "\"https://www.tpecia.com.br\"")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    buildFeatures { buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    buildTypes { release { isMinifyEnabled = false } }
    testOptions { unitTests.isIncludeAndroidResources = true }
}
kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
dependencies {
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.fragment:fragment-ktx:1.8.6")
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.webkit:webkit:1.13.0")
    implementation("androidx.work:work-runtime-ktx:2.10.1")
    implementation("com.google.firebase:firebase-messaging:24.1.1")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
    testImplementation("org.robolectric:robolectric:4.16.1")
    testImplementation("androidx.work:work-testing:2.10.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
}
