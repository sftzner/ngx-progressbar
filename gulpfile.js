/**
 * @Author: @MurhafSousli
 */

const gulp = require('gulp');

/** To log like console.log().. */
var gutil = require('gulp-util');

/** del to remove dist directory */
const del = require('del');

/** load templates and styles in ng2 components */
var embedTemplates = require('gulp-inline-ng2-template');

/** TSLint checker */
const tslint = require('gulp-tslint');

/** Sass style */
const postcss = require('gulp-postcss');
const sass = require('gulp-sass');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const scss = require('postcss-scss');
const stripInlineComments = require('postcss-strip-inline-comments');

/** External command runner */
const exec = require('child_process').exec;

/**OS Access */
const os = require('os');

/** File Access */
const fs = require('fs');
const file = require('gulp-file');
const path = require('path');

/** To properly handle pipes on error */
const pump = require('pump');


const LIBRARY_NAME = 'ng2-progressbar';

const config = {
    allSass: 'src/**/*.scss',
    allTs: 'src/**/*.ts',
    allTsd: 'typings/index.d.ts',
    OutputDir: 'dist/'
};

//Helper functions
function platformPath(path) {
    return /^win/.test(os.platform()) ? `${path}.cmd` : path;
}

// Clean dist directory
gulp.task('clean', function () {
    return del(config.OutputDir);
});

// Compile Sass to css
gulp.task('styles', function (cb) {
    /**
     * Remove comments, autoprefixer, Minifier
     */
    var processors = [
        stripInlineComments,
        autoprefixer,
        cssnano
    ];
    pump(
        [
            gulp.src(config.allSass),
            sass().on('error', sass.logError),
            postcss(processors, { syntax: scss }),
            gulp.dest('src')
        ],
        cb);
});

// TsLint the source files
gulp.task('ts-lint', function (cb) {
    pump(
        [
            gulp.src(config.allTs),
            tslint({ formatter: "verbose" }),
            tslint.report()
        ],
        cb);
});

// Inline templates and styles in ng2 components
gulp.task('inline-templates', ['clean', 'styles', 'ts-lint'], function (cb) {
    var defaults = {
        base: '/src',
        target: 'es5',
        useRelativePaths: true
    };
    pump(
        [
            gulp.src(config.allTs),
            embedTemplates(defaults),
            gulp.dest('./dist/inlined')
        ],
        cb);

});

// Compile inlined TS files with Angular Compiler (ngc)
gulp.task('ngc', ['inline-templates'], function (cb) {
    var executable = path.join(__dirname, platformPath('/node_modules/.bin/ngc'));
    exec(`${executable} -p ./tsconfig-aot.json`, (err) => {
        if (err) return cb(err); // return error
        del('./dist/waste');//delete useless *.ngfactory.ts files( will be regenerated by consumer)
        del('./dist/inlined'); //delete temporary *.ts files with inlined templates and styles 
        cb();
    }).stdout.on('data', function (data) { console.log(data); });
});



// Clean, Lint, Sass to css, Inline templates & Styles and Compile 
gulp.task('compile-ts', ['clean', 'ts-lint', 'styles', 'ngc',]);

gulp.task('watch', function () {
    gulp.watch([config.allTs], ['compile-ts']);
    gulp.watch([config.allSass], ['styles']);
});

// Prepare 'dist' folder publication to NPM
gulp.task('npm', ['compile-ts'], function (cb) {
    var pkgJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    var targetPkgJson = {};
    var fieldsToCopy = ['version', 'description', 'keywords', 'author', 'repository', 'license', 'bugs', 'homepage'];

    targetPkgJson['name'] = LIBRARY_NAME;

    //only copy needed properties from project's package json
    fieldsToCopy.forEach(function (field) { targetPkgJson[field] = pkgJson[field]; });

    targetPkgJson['main'] = `index.js`;
    targetPkgJson['module'] = 'index.js';
    targetPkgJson['typings'] = 'index.d.ts';

    // defines project's dependencies as 'peerDependencies' for final users
    targetPkgJson.peerDependencies = {};
    Object.keys(pkgJson.dependencies).forEach(function (dependency) {
        targetPkgJson.peerDependencies[dependency] = `^${pkgJson.dependencies[dependency]}`;
    });

    // copy the needed additional files in the 'dist' folder
    pump(
        [
            gulp.src(['README.md', 'LICENSE', 'CHANGELOG.md']),
            file('package.json', JSON.stringify(targetPkgJson, null, 2)),
            gulp.dest('dist/')
        ],
        cb);
});

// Publish 'dist' folder to NPM
gulp.task('publish', ['npm'], function (done) {
    // run npm publish terminal command to publish the 'dist' folder only
    exec('npm publish ./dist',
        function (error, stdout, stderr) {
            if (stderr) {
                gutil.log(gutil.colors.red(stderr));
            } else if (stdout) {
                gutil.log(gutil.colors.green(stdout));
            }
            // execute callback when its done 
            if (done) {
                done();
            }
        }
    );
});

// Just build the 'dist' folder (without publishing it to NPM)
gulp.task('build', ['npm']);

gulp.task('default', ['build']);
