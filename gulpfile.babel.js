'use strict';

import path from 'path';
import gulp from 'gulp';
import del from 'del';
import runSequence from 'run-sequence';
import browserSync from 'browser-sync';
import swPrecache from 'sw-precache';
import gulpLoadPlugins from 'gulp-load-plugins';
import {output as pagespeed} from 'psi';
import pkg from './package.json';

import fs from 'fs';
import config from './a5_modules/conf';
import a5Blog from './a5_modules/a5-blog';

const $ = gulpLoadPlugins();
const reload = browserSync.reload;

const archiveFile = __dirname + '/build/blog/archive.json';
const pageIndexFile = __dirname + '/build/sitemap.json';
const xmlNormalizeOpts = {
  parseOpts: {
    trim: true
  },
  buildOpts: {
    renderOpts: {
      pretty: false
    },
    allowSurrogateChars: true,
    cdata: true
  }
};
 
// Lint JavaScript
gulp.task('lint', () =>
  gulp.src([
    'app/scripts/**/*.js',
    '!app/scripts/**/*.min.js',
    '!node_modules/**'
  ])
    .pipe($.eslint())
    .pipe($.eslint.format())
    .pipe($.if(!browserSync.active, $.eslint.failAfterError()))
);

// Optimize images
gulp.task('images', () =>
  gulp.src('app/images/**/*')
    .pipe($.cache($.imagemin({
      progressive: true,
      interlaced: true
    })))
    .pipe(gulp.dest('dist/images'))
    .pipe($.size({title: 'images'}))
);

// Copy all files at the root level (app)
gulp.task('copy', () =>
  gulp.src([
    'app/**/*',
    '!app/_*/*',
    '!app/**/_*',
    '!app/**/*.md',
    '!app/**/*.ejs',
    '!app/**/*.html',
    '!app/styles/**/*',
    '!app/scripts/**/*',
    'node_modules/apache-server-configs/dist/.htaccess'
  ], {
    dot: true
  }).pipe(gulp.dest('dist'))
    .pipe($.size({title: 'copy'}))
);

// Copy all files at the root level (app)
gulp.task('plain.html', () =>
  gulp.src([
    'app/**/*.html'
  ], {
    dot: true
  }).pipe(gulp.dest('build'))
    .pipe($.size({title: 'plain.html'}))
);

// Compile and automatically prefix stylesheets
gulp.task('styles', () => {
  const AUTOPREFIXER_BROWSERS = [
    'ie >= 10',
    'ie_mob >= 10',
    'ff >= 30',
    'chrome >= 34',
    'safari >= 7',
    'opera >= 23',
    'ios >= 7',
    'android >= 4.4',
    'bb >= 10'
  ];

  // For best performance, don't add Sass partials to `gulp.src`
  return gulp.src([
    'app/styles/**/*.scss',
    'app/styles/**/*.css'
  ])
    .pipe($.newer('.tmp/styles'))
    .pipe($.sourcemaps.init())
    .pipe($.sass({
      precision: 10
    }).on('error', $.sass.logError))
    .pipe($.autoprefixer(AUTOPREFIXER_BROWSERS))
    .pipe(gulp.dest('.tmp/styles'))
    // Concatenate and minify styles
    .pipe($.if('*.css', $.cssnano()))
    .pipe($.size({title: 'styles'}))
    .pipe($.sourcemaps.write('./'))
    .pipe(gulp.dest('dist/styles'))
    .pipe(gulp.dest('.tmp/styles'));
});

gulp.task('vendorjs', () =>
    gulp.src([
      './node_modules/jquery/dist/jquery.min.js',
      './node_modules/jquery-validation/dist/jquery.validate.min.js',
      './node_modules/webfontloader/webfontloader.js',
      './node_modules/moment/min/moment.min.js',
      'app/scripts/history.adapter.jquery.min.js',
    ])
      .pipe($.newer('.tmp/scripts'))
      .pipe($.debug({title: 'vendorjs'}))
      .pipe($.concat('vendor.js'))
      // Output files
      .pipe($.size({title: 'vendorjs'}))
      .pipe($.sourcemaps.write('.'))
      .pipe(gulp.dest('dist/scripts'))
      .pipe(gulp.dest('.tmp/scripts'))
);

// Concatenate and minify JavaScript. Optionally transpiles ES2015 code to ES5.
// to enable ES2015 support remove the line `"only": "gulpfile.babel.js",` in the
// `.babelrc` file.
gulp.task('scripts', () =>
    gulp.src([
      './app/scripts/**/*.js',
      '!./app/scripts/history.adapter.jquery.min.js',
    ])
      .pipe($.newer('.tmp/scripts'))
      .pipe($.sourcemaps.init())
      .pipe($.babel())
      .pipe($.sourcemaps.write())
      .pipe(gulp.dest('.tmp/scripts'))
      .pipe($.uglify({preserveComments: 'some'}))
      // Output files
      .pipe($.size({title: 'scripts'}))
      .pipe($.sourcemaps.write('.'))
      .pipe(gulp.dest('dist/scripts'))
      .pipe(gulp.dest('.tmp/scripts'))
);

gulp.task('page.markdown', () => {
  return gulp.src([
    './app/**/*.md',
    '!./app/_*/*',
  ])
    .pipe($.debug({title: 'md'}))
    //.pipe($.frontMatter({remove: true}))
    .pipe($.frontMatter())
    .pipe($.markdown())
    .pipe(a5Blog.ejs())
    .pipe($.htmlPrettify({indent_char: ' ', indent_size: 2}))
    // Output files
    .pipe($.size({title: 'page.markdown'}))
    .pipe(gulp.dest('build'));
});

gulp.task('page.ejs', () => {
  return gulp.src([
    './app/**/*.ejs',
    '!./app/_*/*',
    '!./app/**/_*',
  ])
    .pipe($.debug({title: 'page.ejs'}))
    //.pipe($.frontMatter({remove: true}))
    .pipe($.frontMatter())
    .pipe(a5Blog.ejs())
    .pipe($.htmlPrettify({indent_char: ' ', indent_size: 2}))
    .pipe($.rename((path) => {
      path.extname = '';
    }))
    // Output files
    .pipe($.size({title: 'page.ejs'}))
    .pipe(gulp.dest('build'));
});

gulp.task('page.index', () => {
  return gulp.src([
    './app/**/*.md',
    './app/**/*.ejs',
    '!./app/_*/*',
    '!./app/**/_*',
  ])
    .pipe($.debug({title: 'page.index'}))
    //.pipe($.frontMatter({remove: true}))
    .pipe($.frontMatter())
    .pipe(a5Blog.pageIndex(path.basename(pageIndexFile)))
    .pipe(gulp.dest('build'));
});

gulp.task('blog.archives', () => {
  return gulp.src([
    './app/_posts/*.md',
  ])
    .pipe($.debug({title: 'load...'}))
    .pipe($.frontMatter())
    .pipe($.markdown())
    .pipe(a5Blog.archives(path.basename(archiveFile)))
    .pipe(gulp.dest('build/blog'))
    ;
});

gulp.task('blog.posts', () => {
  var archives = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
  return gulp.src([
    './app/_posts/*.md',
  ])
    .pipe($.debug({title: 'blog.posts'}))
    //.pipe($.frontMatter({remove: true}))
    .pipe($.frontMatter())
    .pipe(a5Blog.posts())
    .pipe($.markdown())
    .pipe(a5Blog.ejs(archives))
    .pipe($.htmlPrettify({indent_char: ' ', indent_size: 2}))
    // Output files
    .pipe($.size({title: 'blog.posts'}))
    .pipe(gulp.dest('build'));
});

gulp.task('blog.index', () => {
  var archives = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
  return gulp.src([
    './app/blog/_index.html.ejs',
  ])
    .pipe($.debug({title: 'blog.index'}))
    .pipe($.frontMatter())
    .pipe(a5Blog.ejs(archives))
    .pipe($.htmlPrettify({indent_char: ' ', indent_size: 2}))
    .pipe($.rename('blog/index.html'))
    .pipe(gulp.dest('build'))
    ;
});

gulp.task('blog.tags', () => {
  var archives = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
  return gulp.src([
    './app/blog/tag/tagname/_index.html.ejs',
  ])
    .pipe($.frontMatter())
    .pipe(a5Blog.generateTagPage(archives))
    .pipe($.debug({title: 'blog tag page'}))
    .pipe(a5Blog.ejs(archives))
    .pipe($.htmlPrettify({indent_char: ' ', indent_size: 2}))
    .pipe(gulp.dest('build/blog/tag/tagname'))
    ;
});

gulp.task('feed', () => {
  var archives = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
  return gulp.src([
    './app/_feed.xml.ejs',
  ])
    .pipe($.debug({title: 'feed'}))
    .pipe($.frontMatter())
    .pipe(a5Blog.ejs(archives))
    .pipe($.xml(xmlNormalizeOpts))
    .pipe($.rename((path) => {
      path.extname = '';
      path.basename = 'feed.xml';
    }))
    .pipe(gulp.dest('build'))
    ;
});

gulp.task('sitemap', () => {
  var archives = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
  var sitemapData = JSON.parse(fs.readFileSync(pageIndexFile, 'utf8'));
  archives.pages = sitemapData.pages;
  return gulp.src([
    './app/_sitemap.xml.ejs',
  ])
    .pipe($.debug({title: 'sitemap'}))
    .pipe($.frontMatter())
    .pipe(a5Blog.ejs(archives))
    .pipe($.xml(xmlNormalizeOpts))
    .pipe($.rename((path) => {
      path.extname = '';
      path.basename = 'sitemap.xml';
    }))
    .pipe(gulp.dest('build'))
    ;
});

// Scan your HTML for assets & optimize them
gulp.task('html', () => {
  return gulp.src([
    'build/**/*.html'
  ])
    .pipe($.useref({
      searchPath: '{.tmp,build}',
      noAssets: true
    }))
    // Minify any HTML
    .pipe($.if('*.html', $.htmlmin({
      removeComments: true,
      collapseWhitespace: true,
      collapseBooleanAttributes: true,
      removeAttributeQuotes: true,
      removeRedundantAttributes: true,
      removeEmptyAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      removeOptionalTags: true
    })))
    // Output files
    .pipe($.if('*.html', $.size({title: 'html', showFiles: true})))
    .pipe(gulp.dest('dist'));
});

// Scan your HTML for assets & optimize them
gulp.task('xml', () => {
  return gulp.src([
    'app/**/*.xml',
    'build/**/*.xml'
  ])
    .pipe($.debug({title: 'xml'}))
    .pipe($.xml(xmlNormalizeOpts))
    .pipe($.if('*.xml', $.size({title: 'xml', showFiles: true})))
    .pipe(gulp.dest('dist'));
});

// Clean output directory
gulp.task('clean', () => del([
  '.tmp',
  'build/*',
  'dist/*',
  '!dist/.git'
], {dot: true}));

// Watch files for changes & reload
gulp.task('serve', ['scripts', 'styles'], () => {
  browserSync({
    notify: false,
    // Customize the Browsersync console logging prefix
    logPrefix: 'WSK',
    // Allow scroll syncing across breakpoints
    scrollElementMapping: ['main', '.mdl-layout'],
    // Run as an https by uncommenting 'https: true'
    // Note: this uses an unsigned certificate which on first access
    //       will present a certificate warning in the browser.
    // https: true,
    server: ['.tmp', 'app', 'build', 'dist'],
    port: 3000
  });

  // gulp serveでは、reloadの反応重視で、必要以上に watch の整合を追究しない
  gulp.watch(['app/_post/*.md'], ['blog.posts', reload]);
  gulp.watch(['app/blog/_index.html.ejs'],
             ['blog.archives', 'blog.index', reload]);
  gulp.watch(['app/blog/_tag.html.ejs'],
             ['blog.archives', 'blog.tags', reload]);
  gulp.watch(['app/_feed.xml.ejs'], ['feed', reload]);

  gulp.watch(['app/**/*.md', '!./app/_*/*'],
             ['page.markdown', reload]);
  gulp.watch(['app/**/*.ejs', '!./app/_*/*'],
             ['page.ejs', reload]);
  gulp.watch(['app/**/*.html', '!./app/_*/*'], [reload]);

  gulp.watch(['app/_sitemap.xml.ejs'], ['page.index', 'sitemap', reload]);

  gulp.watch(['app/styles/**/*.{scss,css}'], ['styles', reload]);
  gulp.watch(['app/scripts/**/*.js'], ['lint', 'scripts', reload]);
  gulp.watch(['app/images/**/*'], reload);

  gulp.watch(['app/_*/*'], ['default', reload]);
});

// Build and serve the output from the dist build
gulp.task('serve:dist', ['default'], () =>
  browserSync({
    notify: false,
    logPrefix: 'WSK',
    // Allow scroll syncing across breakpoints
    scrollElementMapping: ['main', '.mdl-layout'],
    // Run as an https by uncommenting 'https: true'
    // Note: this uses an unsigned certificate which on first access
    //       will present a certificate warning in the browser.
    // https: true,
    server: 'dist',
    port: 3001
  })
);

// Build production files, the default task
gulp.task('default', ['clean'], cb =>
  runSequence(
    ['lint', 'scripts', 'vendorjs', 'styles'],
    ['blog.archives'],
    ['blog.posts', 'blog.index', 'blog.tags', 'feed'],
    ['page.markdown', 'page.ejs', 'page.index'],
    ['sitemap', 'images', 'copy', 'plain.html'],
    ['html', 'xml'],
    //'generate-service-worker',
    cb
  )
);

// Run PageSpeed Insights
gulp.task('pagespeed', cb =>
  // Update the below URL to the public URL of your site
  pagespeed('example.com', {
    strategy: 'mobile'
    // By default we use the PageSpeed Insights free (no API key) tier.
    // Use a Google Developer API key if you have one: http://goo.gl/RkN0vE
    // key: 'YOUR_API_KEY'
  }, cb)
);

// Copy over the scripts that are used in importScripts as part of the generate-service-worker task.
gulp.task('copy-sw-scripts', () => {
  return gulp.src(['node_modules/sw-toolbox/sw-toolbox.js', 'app/scripts/sw/runtime-caching.js'])
    .pipe(gulp.dest('dist/scripts/sw'));
});

// See http://www.html5rocks.com/en/tutorials/service-worker/introduction/ for
// an in-depth explanation of what service workers are and why you should care.
// Generate a service worker file that will provide offline functionality for
// local resources. This should only be done for the 'dist' directory, to allow
// live reload to work as expected when serving from the 'app' directory.
gulp.task('generate-service-worker', ['copy-sw-scripts'], () => {
  const rootDir = 'dist';
  const filepath = path.join(rootDir, 'service-worker.js');

  return swPrecache.write(filepath, {
    // Used to avoid cache conflicts when serving on localhost.
    cacheId: pkg.name || 'web-starter-kit',
    // sw-toolbox.js needs to be listed first. It sets up methods used in runtime-caching.js.
    importScripts: [
      'scripts/sw/sw-toolbox.js',
      'scripts/sw/runtime-caching.js'
    ],
    staticFileGlobs: [
      // Add/remove glob patterns to match your directory setup.
      `${rootDir}/images/**/*`,
      `${rootDir}/scripts/**/*.js`,
      `${rootDir}/styles/**/*.css`,
      `${rootDir}/*.{html,json}`
    ],
    // Translates a static file path to the relative URL that it's served from.
    // This is '/' rather than path.sep because the paths returned from
    // glob always use '/'.
    stripPrefix: rootDir + '/'
  });
});

// Load custom tasks from the `tasks` directory
// Run: `npm install --save-dev require-dir` from the command-line
// try { require('require-dir')('tasks'); } catch (err) { console.error(err); }
