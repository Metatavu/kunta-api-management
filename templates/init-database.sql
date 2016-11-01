create user if not exists root@localhost identified by 'ixPassi';
create database if not exists kam default charset utf8;
grant all on kam.* to root;