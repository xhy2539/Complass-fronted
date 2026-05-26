pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    stages {
        stage('Install Dependencies') {
            steps {
                script {
                    if (isUnix()) {
                        sh '''
                            set -eux
                            npm ci
                        '''
                    } else {
                        bat '''
                            npm ci
                        '''
                    }
                }
            }
        }

        stage('Run Tests') {
            steps {
                script {
                    if (isUnix()) {
                        sh '''
                            set -eux
                            node --test "tests/*.test.mjs"
                        '''
                    } else {
                        bat '''
                            node --test "tests/*.test.mjs"
                        '''
                    }
                }
            }
        }

        stage('Build Frontend') {
            steps {
                script {
                    if (isUnix()) {
                        sh '''
                            set -eux
                            npm run build
                        '''
                    } else {
                        bat '''
                            npm run build
                        '''
                    }
                }
            }
        }
    }
}
